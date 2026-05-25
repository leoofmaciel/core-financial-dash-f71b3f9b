import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Play, Repeat, CalendarClock, Pause } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { logActivity } from "@/lib/logs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recurrences")({
  component: RecurrencesPage,
});

type Rec = {
  id: string;
  name: string;
  description: string | null;
  type: "entrada" | "saida";
  amount: number;
  category_id: string | null;
  payment_method: string | null;
  frequency: "monthly" | "weekly";
  day_of_month: number | null;
  day_of_week: number | null;
  next_run: string;
  active: boolean;
  last_generated_at: string | null;
  categories?: { name: string; color: string } | null;
};

const weekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function RecurrencesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rec | null>(null);

  const { data: recs, isLoading } = useQuery({
    queryKey: ["recurrences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurrences")
        .select("*, categories(name,color)")
        .order("next_run", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Rec[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (r: Rec) => { setEditing(r); setOpen(true); };

  const remove = async (r: Rec) => {
    const { error } = await supabase.from("recurrences").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "recurrence", r.id, { name: r.name });
    toast.success("Recorrência excluída");
    qc.invalidateQueries({ queryKey: ["recurrences"] });
  };

  const toggleActive = async (r: Rec) => {
    const { error } = await supabase.from("recurrences").update({ active: !r.active }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await logActivity("update", "recurrence", r.id, { active: !r.active });
    qc.invalidateQueries({ queryKey: ["recurrences"] });
  };

  const generateNow = async (r: Rec) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: tx, error } = await supabase.from("transactions").insert({
      user_id: user.id,
      name: r.name,
      description: r.description,
      type: r.type,
      amount: r.amount,
      category_id: r.category_id,
      payment_method: r.payment_method,
      transaction_date: r.next_run,
      due_date: r.next_run,
      status: "pendente",
    }).select().single();
    if (error) return toast.error(error.message);

    const nextRun = r.frequency === "monthly"
      ? addMonths(r.next_run, 1)
      : addDays(r.next_run, 7);

    await supabase.from("recurrences").update({
      next_run: nextRun,
      last_generated_at: new Date().toISOString(),
    }).eq("id", r.id);

    await logActivity("create", "transaction", tx.id, { from_recurrence: r.id, name: r.name });
    toast.success(`Lançamento gerado para ${formatDate(r.next_run)}`);
    qc.invalidateQueries({ queryKey: ["recurrences"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const due = (recs ?? []).filter((r) => r.active && r.next_run <= today);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Repeat className="h-7 w-7 text-primary" /> Recorrências
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie lançamentos fixos mensais e semanais.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova recorrência</Button>
      </div>

      {due.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/15 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-warning">{due.length} recorrência(s) vencida(s) hoje ou antes</p>
              <p className="text-sm text-muted-foreground">Clique em "Gerar" para criar o lançamento.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Lançamentos fixos</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (recs?.length ?? 0) === 0 ? (
            <div className="text-center py-12">
              <Repeat className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma recorrência cadastrada.</p>
              <Button variant="link" onClick={openNew}>Criar a primeira</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Próximo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recs!.map((r) => {
                    const overdue = r.active && r.next_run <= today;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          <Badge variant={r.type === "entrada" ? "default" : "destructive"}>
                            {r.type === "entrada" ? "Entrada" : "Saída"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.categories ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span className="h-2 w-2 rounded-full" style={{ background: r.categories.color }} />
                              {r.categories.name}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.frequency === "monthly"
                            ? `Mensal (dia ${r.day_of_month ?? "—"})`
                            : `Semanal (${weekDays[r.day_of_week ?? 0]})`}
                        </TableCell>
                        <TableCell className={overdue ? "text-warning font-semibold" : ""}>
                          {formatDate(r.next_run)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${r.type === "entrada" ? "text-success" : "text-destructive"}`}>
                          {formatBRL(r.amount)}
                        </TableCell>
                        <TableCell>
                          <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant={overdue ? "default" : "outline"} onClick={() => generateNow(r)} disabled={!r.active} title="Gerar lançamento agora">
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
                                  <AlertDialogDescription>"{r.name}" será removida. Lançamentos já gerados não serão afetados.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => remove(r)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RecurrenceDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        categories={categories ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["recurrences"] })}
      />
    </div>
  );
}

function RecurrenceDialog({
  open, onOpenChange, editing, categories, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Rec | null;
  categories: Array<{ id: string; name: string; color: string }>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Rec>>({});
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  useState(() => {});
  // initialize on open
  if (open && form && (editing?.id ?? null) !== (form.id ?? null)) {
    setForm(editing ?? {
      name: "",
      type: "saida",
      amount: 0,
      frequency: "monthly",
      day_of_month: new Date().getDate(),
      day_of_week: 1,
      next_run: new Date().toISOString().slice(0, 10),
      active: true,
      category_id: null,
      payment_method: "",
      description: "",
    });
  }

  const set = <K extends keyof Rec>(k: K, v: Rec[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name || !form.amount || !form.next_run) {
      toast.error("Preencha nome, valor e data");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload = {
      user_id: user.id,
      name: form.name,
      description: form.description || null,
      type: form.type ?? "saida",
      amount: Number(form.amount),
      category_id: form.category_id || null,
      payment_method: form.payment_method || null,
      frequency: form.frequency ?? "monthly",
      day_of_month: form.frequency === "monthly" ? Number(form.day_of_month) : null,
      day_of_week: form.frequency === "weekly" ? Number(form.day_of_week) : null,
      next_run: form.next_run,
      active: form.active ?? true,
    };

    if (editing) {
      const { error } = await supabase.from("recurrences").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      await logActivity("update", "recurrence", editing.id, { name: payload.name });
      toast.success("Recorrência atualizada");
    } else {
      const { data, error } = await supabase.from("recurrences").insert(payload).select().single();
      setSaving(false);
      if (error) return toast.error(error.message);
      await logActivity("create", "recurrence", data.id, { name: payload.name });
      toast.success("Recorrência criada");
    }
    onOpenChange(false);
    setForm({});
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm({}); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar recorrência" : "Nova recorrência"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Aluguel, Salário…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type ?? "saida"} onValueChange={(v) => set("type", v as Rec["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.amount ?? ""} onChange={(e) => set("amount", Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id ?? "none"} onValueChange={(v) => set("category_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Input value={form.payment_method ?? ""} onChange={(e) => set("payment_method", e.target.value)} placeholder="Pix, Cartão…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Frequência</Label>
              <Select value={form.frequency ?? "monthly"} onValueChange={(v) => set("frequency", v as Rec["frequency"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.frequency === "weekly" ? (
              <div>
                <Label>Dia da semana</Label>
                <Select value={String(form.day_of_week ?? 1)} onValueChange={(v) => set("day_of_week", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {weekDays.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Dia do mês</Label>
                <Input type="number" min={1} max={31} value={form.day_of_month ?? ""} onChange={(e) => set("day_of_month", Number(e.target.value))} />
              </div>
            )}
          </div>

          <div>
            <Label>Próxima execução</Label>
            <Input type="date" value={form.next_run ?? ""} onChange={(e) => set("next_run", e.target.value)} />
          </div>

          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
            <div className="flex items-center gap-2">
              {form.active ? <Play className="h-4 w-4 text-success" /> : <Pause className="h-4 w-4 text-muted-foreground" />}
              <span className="text-sm font-medium">Recorrência ativa</span>
            </div>
            <Switch checked={form.active ?? true} onCheckedChange={(v) => set("active", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
