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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Paperclip, Upload, X, FileDown, Filter, ArrowDownCircle, ArrowUpCircle, ListFilter } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/format";
import { logActivity } from "@/lib/logs";
import { Pagination, paginate } from "@/components/pagination";
import { exportCSV } from "@/lib/csv";

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
  recurring: false, recurring_count: "3",
};

function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function TransactionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
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

  const openNew = () => {
    reset();
    const defType: "entrada" | "saida" | null =
      filterType === "entrada" ? "entrada" : filterType === "saida" ? "saida" : null;
    if (defType) setForm({ ...emptyForm, type: defType });
    setOpen(true);
  };
  const openEdit = (t: Tx) => {
    setEditing(t);
    setForm({
      ...emptyForm,
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
    const basePayload = {
      user_id: user.id, type: form.type, name: form.name,
      category_id: form.category_id || null, description: form.description || null,
      amount: Number(form.amount), payment_method: form.payment_method || null,
      status: form.status,
      notes: form.notes || null,
      attachment_url: form.attachment_url || null,
    };
    if (editing) {
      const res = await supabase.from("transactions").update({
        ...basePayload, transaction_date: form.transaction_date, due_date: form.due_date || null,
      }).eq("id", editing.id).select().single();
      if (res.error) return toast.error(res.error.message);
      await logActivity("update", "transaction", res.data?.id, { name: form.name, amount: basePayload.amount });
      toast.success("Movimentação atualizada");
    } else {
      const count = form.recurring ? Math.max(1, Math.min(36, Number(form.recurring_count) || 1)) : 1;
      const rows = Array.from({ length: count }).map((_, i) => ({
        ...basePayload,
        transaction_date: i === 0 ? form.transaction_date : addMonths(form.transaction_date, i),
        due_date: form.due_date ? (i === 0 ? form.due_date : addMonths(form.due_date, i)) : null,
        status: i === 0 ? form.status : "pendente",
      }));
      const res = await supabase.from("transactions").insert(rows).select();
      if (res.error) return toast.error(res.error.message);
      await logActivity("create", "transaction", res.data?.[0]?.id, { name: form.name, amount: basePayload.amount, count });
      toast.success(count > 1 ? `${count} movimentações criadas` : "Movimentação criada");
    }
    setOpen(false); reset();
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const remove = async (t: Tx) => {
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    if (t.attachment_url) await supabase.storage.from("attachments").remove([t.attachment_url]);
    await logActivity("delete", "transaction", t.id, { name: t.name });
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const filtered = txs.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !String(t.code).includes(search)) return false;
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterCategory !== "all" && t.category_id !== filterCategory) return false;
    if (filterFrom && t.transaction_date < filterFrom) return false;
    if (filterTo && t.transaction_date > filterTo) return false;
    return true;
  });
  const pageItems = paginate(filtered, page, pageSize);

  const clearFilters = () => {
    setSearch(""); setFilterType("all"); setFilterStatus("all");
    setFilterCategory("all"); setFilterFrom(""); setFilterTo("");
  };

  const exportToCSV = () => {
    exportCSV(`movimentacoes-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Código", "Data", "Vencimento", "Tipo", "Nome", "Categoria", "Status", "Forma pagamento", "Valor"],
      ...filtered.map((t) => [
        t.code, formatDate(t.transaction_date), formatDate(t.due_date),
        t.type, t.name, t.categories?.name ?? "—", t.status,
        t.payment_method ?? "—", Number(t.amount).toFixed(2).replace(".", ","),
      ]),
    ]);
  };

  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pago: "default", pendente: "secondary", atrasado: "destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {filterType === "entrada" ? "Contas a receber" : filterType === "saida" ? "Contas a pagar" : "Movimentações"}
          </h1>
          <p className="text-sm text-muted-foreground">Controle de entradas e saídas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}><FileDown className="h-4 w-4 mr-1" /> Exportar</Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" />
                {filterType === "entrada" ? "Nova conta a receber" : filterType === "saida" ? "Nova conta a pagar" : "Nova movimentação"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                {!editing && (
                  <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="recurring"
                        checked={form.recurring}
                        onCheckedChange={(v) => setForm({ ...form, recurring: !!v })}
                      />
                      <Label htmlFor="recurring" className="cursor-pointer">Repetir mensalmente</Label>
                    </div>
                    {form.recurring && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Quantidade de parcelas</Label>
                        <Input
                          type="number" min="2" max="36"
                          className="w-24"
                          value={form.recurring_count}
                          onChange={(e) => setForm({ ...form, recurring_count: e.target.value })}
                        />
                        <span className="text-xs text-muted-foreground">
                          Criará uma cópia por mês, a partir da data informada.
                        </span>
                      </div>
                    )}
                  </div>
                )}
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
      </div>

      <Tabs value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all"><ListFilter className="h-4 w-4 mr-1" /> Todas</TabsTrigger>
          <TabsTrigger value="entrada"><ArrowDownCircle className="h-4 w-4 mr-1 text-success" /> A receber</TabsTrigger>
          <TabsTrigger value="saida"><ArrowUpCircle className="h-4 w-4 mr-1 text-destructive" /> A pagar</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" className="w-[160px]" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" className="w-[160px]" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <Filter className="h-4 w-4 mr-1" /> Limpar filtros
            </Button>
            <div className="ml-auto text-sm text-muted-foreground">
              {filtered.length} resultado(s)
            </div>
          </div>
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
