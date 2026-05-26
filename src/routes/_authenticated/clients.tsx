import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/logs";

export const Route = createFileRoute("/_authenticated/clients")({ component: ClientsPage });

type ClientRow = {
  id: string; name: string; company: string | null; cnpj: string | null;
  email: string | null; phone: string | null; address: string | null;
  contact_name: string | null; notes: string | null;
};

const empty = { name: "", company: "", cnpj: "", email: "", phone: "", address: "", contact_name: "", notes: "" };

function ClientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: ClientRow) => {
    setEditing(c);
    setForm({ name: c.name, company: c.company ?? "", cnpj: c.cnpj ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", contact_name: c.contact_name ?? "", notes: c.notes ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { ...form, user_id: user.id };
    if (editing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logActivity("update", "client", editing.id, { name: form.name });
    } else {
      const { data, error } = await supabase.from("clients").insert(payload).select().single();
      if (error) return toast.error(error.message);
      await logActivity("create", "client", data.id, { name: form.name });
    }
    toast.success("Cliente salvo");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const remove = async (c: ClientRow) => {
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "client", c.id, { name: c.name });
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const filtered = data.filter((c) => {
    const s = search.toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || (c.company ?? "").toLowerCase().includes(s) || (c.cnpj ?? "").includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Cadastre clientes para usar em pedidos e orçamentos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo cliente</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} /></div>
              <div className="space-y-2"><Label>Empresa</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} maxLength={120} /></div>
              <div className="space-y-2"><Label>CNPJ / CPF</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} maxLength={20} /></div>
              <div className="space-y-2"><Label>Contato</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} maxLength={120} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={150} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={200} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, empresa ou CNPJ" className="pl-9" />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum cliente cadastrado.</TableCell></TableRow>}
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.company || "—"}</TableCell>
                    <TableCell>{c.cnpj || "—"}</TableCell>
                    <TableCell>{[c.phone, c.email].filter(Boolean).join(" • ") || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir cliente?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(c)}>Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
