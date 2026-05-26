import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { RM_INVESTMENTS, RM_PARTNERS, RM_RECURRENCES, RM_TASKS } from "@/lib/rm-seed";

export const Route = createFileRoute("/_authenticated/investments")({ component: InvestmentsPage });

type Investment = { id: string; description: string; amount: number; status: string; position: number; notes: string | null };
type Partner = { id: string; name: string };
type Payment = { id: string; investment_id: string; partner_id: string; amount: number };

function InvestmentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [form, setForm] = useState<{ description: string; amount: number; status: string; payments: Record<string, number> }>({ description: "", amount: 0, status: "pendente", payments: {} });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("id, name").order("position");
      if (error) throw error;
      return data as Partner[];
    },
  });

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("*").order("position");
      if (error) throw error;
      return data as Investment[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["investment_payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investment_payments").select("*");
      if (error) throw error;
      return data as Payment[];
    },
  });

  const totals = useMemo(() => {
    const total = investments.reduce((s, i) => s + Number(i.amount || 0), 0);
    const byPartner: Record<string, number> = {};
    payments.forEach((p) => { byPartner[p.partner_id] = (byPartner[p.partner_id] || 0) + Number(p.amount || 0); });
    return { total, byPartner };
  }, [investments, payments]);

  const openNew = () => {
    setEditing(null);
    const pays: Record<string, number> = {};
    partners.forEach((p) => (pays[p.id] = 0));
    setForm({ description: "", amount: 0, status: "pendente", payments: pays });
    setOpen(true);
  };
  const openEdit = (inv: Investment) => {
    setEditing(inv);
    const pays: Record<string, number> = {};
    partners.forEach((p) => { pays[p.id] = Number(payments.find((x) => x.investment_id === inv.id && x.partner_id === p.id)?.amount || 0); });
    setForm({ description: inv.description, amount: Number(inv.amount), status: inv.status, payments: pays });
    setOpen(true);
  };

  const save = async () => {
    if (!form.description.trim()) return toast.error("Descrição obrigatória");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let invId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("investments").update({ description: form.description, amount: form.amount, status: form.status }).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("investments").insert({ description: form.description, amount: form.amount, status: form.status, position: investments.length, user_id: user.id }).select().single();
      if (error) return toast.error(error.message);
      invId = data.id;
    }
    if (invId) {
      await supabase.from("investment_payments").delete().eq("investment_id", invId);
      const rows = Object.entries(form.payments).filter(([, v]) => Number(v) > 0).map(([partner_id, amount]) => ({ investment_id: invId, partner_id, amount: Number(amount) }));
      if (rows.length) await supabase.from("investment_payments").insert(rows);
    }
    toast.success("Investimento salvo");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["investments"] });
    qc.invalidateQueries({ queryKey: ["investment_payments"] });
  };

  const remove = async (inv: Investment) => {
    const { error } = await supabase.from("investments").delete().eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["investments"] });
  };

  const importRM = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    toast.loading("Importando planilha RM...", { id: "import" });
    try {
      // Sócios
      const partnerMap: Record<string, string> = {};
      for (const p of RM_PARTNERS) {
        const existing = partners.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
        if (existing) { partnerMap[p.name] = existing.id; continue; }
        const { data, error } = await supabase.from("partners").insert({ ...p, user_id: user.id }).select().single();
        if (error) throw error;
        partnerMap[p.name] = data.id;
      }
      // Investimentos + pagamentos
      for (let i = 0; i < RM_INVESTMENTS.length; i++) {
        const item = RM_INVESTMENTS[i];
        const { data: inv, error } = await supabase.from("investments").insert({ description: item.description, amount: item.amount, status: item.status, position: i, user_id: user.id }).select().single();
        if (error) throw error;
        const rows = Object.entries(item.payments).filter(([, v]) => v > 0).map(([name, amount]) => ({ investment_id: inv.id, partner_id: partnerMap[name], amount }));
        if (rows.length) await supabase.from("investment_payments").insert(rows);
      }
      // Recorrências + transações pendentes
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const dueDate = new Date(today.getFullYear(), today.getMonth(), 10).toISOString().slice(0, 10);
      for (const r of RM_RECURRENCES) {
        await supabase.from("recurrences").insert({ name: r.name, amount: r.amount, type: "saida", frequency: "monthly", day_of_month: 10, next_run: monthStart, user_id: user.id });
        await supabase.from("transactions").insert({ name: r.name, amount: r.amount, type: "saida", status: "pendente", due_date: dueDate, user_id: user.id });
      }
      // Tarefas
      for (let i = 0; i < RM_TASKS.length; i++) {
        await supabase.from("tasks").insert({ title: RM_TASKS[i], position: i, user_id: user.id });
      }
      toast.success("Importação concluída!", { id: "import" });
      qc.invalidateQueries();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro: " + msg, { id: "import" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Investimentos</h1>
          <p className="text-sm text-muted-foreground">Investimentos iniciais com rateio entre sócios.</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline"><Download className="h-4 w-4 mr-1" /> Importar planilha RM</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Importar dados da planilha RM?</AlertDialogTitle>
              </AlertDialogHeader>
              <p className="text-sm text-muted-foreground">Vai criar os sócios Moisés e Paulo (se não existirem), 40 investimentos, 4 recorrências mensais (Aluguel, Água, Luz, Contador) com as transações pendentes do mês, e 3 tarefas.</p>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={importRM}>Importar</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Editar investimento" : "Novo investimento"}</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-2"><Label>Descrição *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={120} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Valor total</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="ok">OK / Pago</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                {partners.length > 0 && (
                  <div className="space-y-2">
                    <Label>Pagamento por sócio</Label>
                    {partners.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="w-28 text-sm">{p.name}</span>
                        <Input type="number" step="0.01" value={form.payments[p.id] ?? 0} onChange={(e) => setForm({ ...form, payments: { ...form.payments, [p.id]: Number(e.target.value) } })} />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">Soma: {formatBRL(Object.values(form.payments).reduce((s, v) => s + Number(v || 0), 0))}</p>
                  </div>
                )}
                {partners.length === 0 && <p className="text-xs text-destructive">Cadastre sócios primeiro para registrar o rateio.</p>}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total investido</p><p className="text-2xl font-bold">{formatBRL(totals.total)}</p></CardContent></Card>
        {partners.slice(0, 2).map((p) => {
          const paid = totals.byPartner[p.id] || 0;
          const expected = totals.total * (partners.length ? 1 / partners.length : 0);
          const diff = paid - expected;
          return (
            <Card key={p.id}><CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{p.name} pagou</p>
              <p className="text-2xl font-bold">{formatBRL(paid)}</p>
              <p className={`text-xs mt-1 ${diff >= 0 ? "text-green-600" : "text-destructive"}`}>{diff >= 0 ? "+" : ""}{formatBRL(diff)} vs. esperado</p>
            </CardContent></Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                {partners.map((p) => <TableHead key={p.id} className="text-right">{p.name}</TableHead>)}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4 + partners.length} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && investments.length === 0 && <TableRow><TableCell colSpan={4 + partners.length} className="text-center py-8 text-muted-foreground">Nenhum investimento. Clique em "Importar planilha RM" para começar.</TableCell></TableRow>}
              {investments.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.description}</TableCell>
                  <TableCell className="text-right">{formatBRL(Number(inv.amount))}</TableCell>
                  <TableCell><Badge variant={inv.status === "ok" ? "default" : "secondary"}>{inv.status}</Badge></TableCell>
                  {partners.map((p) => {
                    const v = payments.find((x) => x.investment_id === inv.id && x.partner_id === p.id);
                    return <TableCell key={p.id} className="text-right text-sm">{v ? formatBRL(Number(v.amount)) : "—"}</TableCell>;
                  })}
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(inv)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(inv)}>Excluir</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
