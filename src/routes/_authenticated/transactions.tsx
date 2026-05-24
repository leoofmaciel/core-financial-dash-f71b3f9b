import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/format";
import { logActivity } from "@/lib/logs";
import { Pagination, paginate } from "@/components/pagination";

export const Route = createFileRoute("/_authenticated/transactions")({ component: TransactionsPage });

type Tx = {
  id: string; code: number; type: "entrada" | "saida"; name: string; category_id: string | null;
  description: string | null; amount: number; payment_method: string | null;
  status: "pago" | "pendente" | "atrasado"; transaction_date: string; due_date: string | null;
  notes: string | null; attachment_url: string | null;
  categories?: { name: string; color: string } | null;
};

const emptyForm = {
  type: "entrada" as "entrada" | "saida", name: "", category_id: "", description: "", amount: "",
  payment_method: "", status: "pago" as "pago" | "pendente" | "atrasado",
  transaction_date: new Date().toISOString().slice(0, 10), due_date: "", notes: "",
  attachment_url: "" as string,
};

function TransactionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions").select("*, categories(name, color)").order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as Tx[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data ?? [];
    },
  });

  const reset = () => { setForm(emptyForm); setEditing(null); };

  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (t: Tx) => {
    setEditing(t);
    setForm({
      type: t.type, name: t.name, category_id: t.category_id ?? "", description: t.description ?? "",
      amount: String(t.amount), payment_method: t.payment_method ?? "", status: t.status,
      transaction_date: t.transaction_date, due_date: t.due_date ?? "", notes: t.notes ?? "",
      attachment_url: t.attachment_url ?? "",
    });
    setOpen(true);
  };

  const handleUpload = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file);
    setUploading(false);
    if (error) return toast.error("Erro no upload: " + error.message);
    setForm((f) => ({ ...f, attachment_url: path }));
    toast.success("Comprovante anexado");
  };

  const removeAttachment = async () => {
    if (!form.attachment_url) return;
    await supabase.storage.from("attachments").remove([form.attachment_url]);
    setForm((f) => ({ ...f, attachment_url: "" }));
  };

  const downloadAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Erro ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      user_id: user.id, type: form.type, name: form.name,
      category_id: form.category_id || null, description: form.description || null,
      amount: Number(form.amount), payment_method: form.payment_method || null,
      status: form.status, transaction_date: form.transaction_date,
      due_date: form.due_date || null, notes: form.notes || null,
      attachment_url: form.attachment_url || null,
    };
    const res = editing
      ? await supabase.from("transactions").update(payload).eq("id", editing.id).select().single()
      : await supabase.from("transactions").insert(payload).select().single();
    if (res.error) return toast.error(res.error.message);
    await logActivity(editing ? "update" : "create", "transaction", res.data?.id, { name: form.name, amount: payload.amount });
    toast.success(editing ? "Movimentação atualizada" : "Movimentação criada");
    setOpen(false); reset();
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const remove = async (t: Tx) => {
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    if (t.attachment_url) await supabase.storage.from("attachments").remove([t.attachment_url]);
    await logActivity("delete", "transaction", t.id, { name: t.name });
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const filtered = txs.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !String(t.code).includes(search)) return false;
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });
  const pageItems = paginate(filtered, page, pageSize);

  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pago: "default", pendente: "secondary", atrasado: "destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Movimentações</h1>
          <p className="text-sm text-muted-foreground">Controle de entradas e saídas.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova movimentação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} movimentação</DialogTitle></DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v: "entrada" | "saida") => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: "pago" | "pendente" | "atrasado") => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="PIX, Cartão, Boleto..." />
              </div>
              <div className="space-y-2">
                <Label>Data da movimentação</Label>
                <Input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Vencimento</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Comprovante</Label>
                {form.attachment_url ? (
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">{form.attachment_url.split("/").pop()}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => downloadAttachment(form.attachment_url)}>Ver</Button>
                    <Button type="button" size="icon" variant="ghost" onClick={removeAttachment}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-3 rounded-md border border-dashed cursor-pointer hover:bg-muted/30 transition">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">{uploading ? "Enviando..." : "Selecionar arquivo (PDF, imagem)"}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>{editing ? "Atualizar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma movimentação.</TableCell></TableRow>}
              {pageItems.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${t.type === "entrada" ? "bg-success" : "bg-destructive"}`} />
                      <span className="font-medium">{t.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.categories?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{formatDate(t.transaction_date)}</TableCell>
                  <TableCell><Badge variant={statusVariant[t.status]}>{t.status}</Badge></TableCell>
                  <TableCell className={`text-right font-semibold ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                    <div className="flex items-center justify-end gap-2">
                      {t.attachment_url && (
                        <button onClick={() => downloadAttachment(t.attachment_url!)} title="Ver comprovante">
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                        </button>
                      )}
                      <span>{t.type === "entrada" ? "+" : "-"} {formatBRL(t.amount)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(t)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
