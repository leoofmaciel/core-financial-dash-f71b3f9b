import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Trash2, FileText, CheckCircle2, Save, X, UserPlus, Loader2,
  CircleCheck, Receipt, History as HistoryIcon, Send, CalendarDays,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { generateBudgetPDF } from "@/lib/pdf";
import { logActivity } from "@/lib/logs";
import { SendOrderDialog } from "@/components/send-order-dialog";
import { OrderAttachments } from "@/components/order-attachments";

type Item = { id?: string; description: string; quantity: number; unit_price: number; total: number };

const statusOptions = [
  { value: "rascunho", label: "Rascunho", variant: "outline" as const },
  { value: "orcamento", label: "Orçamento gerado", variant: "secondary" as const },
  { value: "orcamento_enviado", label: "Enviado", variant: "secondary" as const },
  { value: "visualizado", label: "Visualizado", variant: "secondary" as const },
  { value: "aguardando_retorno", label: "Aguardando retorno", variant: "secondary" as const },
  { value: "aprovado", label: "Aprovado", variant: "default" as const },
  { value: "cancelado", label: "Cancelado", variant: "destructive" as const },
];

export function OrderHubDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null; // "new" or uuid
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const isNew = orderId === "new";
  const [currentId, setCurrentId] = useState<string | null>(isNew ? null : orderId);
  const [order, setOrder] = useState<any>({ status: "rascunho", client_id: null, delivery_time: "", payment_terms: "", notes: "" });
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const skipAutoSave = useRef(true);

  useEffect(() => {
    if (!open) return;
    skipAutoSave.current = true;
    setCurrentId(isNew ? null : orderId);
    setDirty(false);
    setLastSaved(null);
    if (isNew) {
      setOrder({ status: "rascunho", client_id: null, delivery_time: "", payment_terms: "", notes: "" });
      setItems([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
      setTimeout(() => { skipAutoSave.current = false; }, 200);
      return;
    }
    (async () => {
      setLoading(true);
      const [{ data: o }, { data: its }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId!).single(),
        supabase.from("order_items").select("*").eq("order_id", orderId!).order("position"),
      ]);
      if (o) setOrder(o);
      if (its && its.length) setItems(its as Item[]);
      else setItems([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
      setLoading(false);
      setTimeout(() => { skipAutoSave.current = false; }, 200);
    })();
  }, [open, orderId, isNew]);

  // clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, company, cnpj, email, phone, address").order("name");
      return data ?? [];
    },
  });
  const selectedClient = useMemo(() => clients.find((c: any) => c.id === order.client_id), [clients, order.client_id]);

  // activity logs (history)
  const { data: logs = [] } = useQuery({
    queryKey: ["order-logs", currentId],
    queryFn: async () => {
      if (!currentId) return [];
      const { data } = await supabase
        .from("activity_logs")
        .select("*, profile:profiles(full_name, email)")
        .eq("entity", "order")
        .eq("entity_id", currentId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!currentId,
  });

  // linked transaction
  const { data: linkedTx } = useQuery({
    queryKey: ["order-tx", currentId],
    queryFn: async () => {
      if (!currentId) return null;
      const { data } = await supabase.from("transactions").select("*").eq("order_id", currentId).eq("type", "entrada").maybeSingle();
      return data;
    },
    enabled: !!currentId,
  });

  const total = useMemo(() => items.reduce((s, i) => s + Number(i.total || 0), 0), [items]);

  const markDirty = () => { if (!skipAutoSave.current) setDirty(true); };

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      next.total = Number(next.quantity || 0) * Number(next.unit_price || 0);
      return next;
    }));
    markDirty();
  };
  const addItem = () => { setItems([...items, { description: "", quantity: 1, unit_price: 0, total: 0 }]); markDirty(); };
  const removeItem = (idx: number) => { setItems(items.filter((_, i) => i !== idx)); markDirty(); };

  const setField = (patch: any) => { setOrder({ ...order, ...patch }); markDirty(); };

  const persist = async (silent = false): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    if (!order.client_id) { if (!silent) toast.error("Selecione um cliente"); return null; }
    setSaving(true);
    const payload: any = {
      user_id: user.id,
      client_id: order.client_id,
      status: order.status,
      total,
      delivery_time: order.delivery_time || null,
      payment_terms: order.payment_terms || null,
      notes: order.notes || null,
    };
    if (order.created_at) payload.created_at = order.created_at;
    let id = currentId;
    let createdAtChanged = false;
    if (!id) {
      const { data, error } = await supabase.from("orders").insert(payload).select().single();
      if (error) { setSaving(false); if (!silent) toast.error(error.message); return null; }
      id = data.id;
      setCurrentId(id);
      setOrder(data);
    } else {
      // detect if date changed by fetching current
      const { data: prev } = await supabase.from("orders").select("created_at").eq("id", id).single();
      if (prev && order.created_at && String(prev.created_at).slice(0, 10) !== String(order.created_at).slice(0, 10)) {
        createdAtChanged = true;
      }
      const { error } = await supabase.from("orders").update(payload).eq("id", id);
      if (error) { setSaving(false); if (!silent) toast.error(error.message); return null; }
      if (createdAtChanged) {
        await supabase.from("transactions").update({ transaction_date: String(order.created_at).slice(0, 10) }).eq("order_id", id);
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["order-tx", id] });
      }
    }
    await supabase.from("order_items").delete().eq("order_id", id!);
    const rows = items.filter((i) => i.description).map((i, idx) => ({
      order_id: id!, description: i.description, quantity: Number(i.quantity),
      unit_price: Number(i.unit_price), total: Number(i.total), position: idx,
    }));
    if (rows.length) await supabase.from("order_items").insert(rows);
    await logActivity(currentId ? "update" : "create", "order", id!, { total });
    setSaving(false);
    setDirty(false);
    setLastSaved(new Date());
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["order-logs", id] });
    if (!silent) toast.success("Pedido salvo");
    return id;
  };

  // Auto-save (debounce 1.5s)
  useEffect(() => {
    if (!dirty || !open) return;
    const t = setTimeout(() => { if (order.client_id) persist(true); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, order, items]);

  const generatePDF = async () => {
    const id = await persist(true);
    if (!id || !selectedClient) return toast.error("Selecione um cliente");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const budgetPayload = {
      user_id: user.id,
      order_id: id,
      client_name: selectedClient.name,
      client_company: selectedClient.company,
      client_phone: selectedClient.phone,
      client_email: selectedClient.email,
      delivery_time: order.delivery_time,
      payment_terms: order.payment_terms,
      notes: order.notes,
      total,
    };
    const { data: existing } = await supabase.from("budgets").select("id").eq("order_id", id).maybeSingle();
    let bId = existing?.id;
    if (bId) {
      await supabase.from("budgets").update(budgetPayload).eq("id", bId);
      await supabase.from("budget_items").delete().eq("budget_id", bId);
    } else {
      const { data: b, error } = await supabase.from("budgets").insert(budgetPayload).select().single();
      if (error) return toast.error(error.message);
      bId = b.id;
    }
    const bi = items.filter((i) => i.description).map((i, idx) => ({
      budget_id: bId!, description: i.description, quantity: Number(i.quantity),
      unit_price: Number(i.unit_price), total: Number(i.total), position: idx,
    }));
    if (bi.length) await supabase.from("budget_items").insert(bi);
    await supabase.from("orders").update({ status: "orcamento" }).eq("id", id);
    setOrder((o: any) => ({ ...o, status: "orcamento" }));
    await logActivity("generate_budget", "order", id, { budget_id: bId });
    const { data: company } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
    const { data: b } = await supabase.from("budgets").select("*").eq("id", bId!).single();
    await generateBudgetPDF({ ...b!, items: bi } as any, company ?? {});
    toast.success("Orçamento gerado e baixado");
    qc.invalidateQueries({ queryKey: ["order-logs", id] });
  };

  const approve = async () => {
    const id = await persist(true);
    if (!id || !selectedClient) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: tx, error } = await supabase.from("transactions").insert({
      user_id: user.id,
      order_id: id,
      name: `Pedido #${String(order.number ?? "").padStart(5, "0")} - ${selectedClient.name}`,
      description: "Recebimento do pedido aprovado",
      type: "entrada",
      amount: total,
      status: "pendente",
      transaction_date: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("orders").update({ status: "aprovado", approved_at: new Date().toISOString() }).eq("id", id);
    setOrder((o: any) => ({ ...o, status: "aprovado" }));
    await logActivity("approve", "order", id, { transaction_id: tx.id, total });
    toast.success("Pedido aprovado e conta a receber criada");
    qc.invalidateQueries({ queryKey: ["order-tx", id] });
    qc.invalidateQueries({ queryKey: ["order-logs", id] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const markTxPaid = async () => {
    if (!linkedTx) return;
    const { error } = await supabase.from("transactions").update({ status: "pago" }).eq("id", linkedTx.id);
    if (error) return toast.error(error.message);
    await logActivity("mark_paid", "transaction", linkedTx.id);
    toast.success("Conta marcada como paga");
    qc.invalidateQueries({ queryKey: ["order-tx", currentId] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const currentStatus = statusOptions.find((s) => s.value === order.status) ?? statusOptions[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[1400px] w-[98vw] h-[95vh] p-0 gap-0 flex flex-col overflow-hidden"
        onInteractOutside={(e) => dirty && e.preventDefault()}
      >
        {/* Header */}
        <div className="h-14 px-4 sm:px-6 border-b flex items-center gap-3 bg-card shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-mono text-sm text-muted-foreground">
              {currentId && order.number ? `#${String(order.number).padStart(5, "0")}` : "Novo pedido"}
            </span>
            <Separator orientation="vertical" className="h-5" />
            <Select value={order.status} onValueChange={(v) => setField({ status: v })}>
              <SelectTrigger className="h-7 w-auto border-0 shadow-none px-2 gap-1">
                <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm font-medium truncate">{selectedClient?.name ?? "Sem cliente"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {saving && <><Loader2 className="h-3 w-3 animate-spin" /> salvando…</>}
            {!saving && lastSaved && <><CircleCheck className="h-3 w-3 text-green-600" /> salvo {lastSaved.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>}
          </div>
          <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
            {/* Left: client */}
            <div className="col-span-12 lg:col-span-3 border-r overflow-y-auto p-4 space-y-4 bg-muted/20">
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Cliente</h3>
                <ClientPicker
                  value={order.client_id}
                  clients={clients}
                  onChange={(id) => setField({ client_id: id })}
                  onCreated={(c) => { qc.invalidateQueries({ queryKey: ["clients-min"] }); setField({ client_id: c.id }); }}
                />
              </div>
              {selectedClient && (
                <div className="space-y-2 text-sm">
                  {selectedClient.company && <Field label="Empresa" value={selectedClient.company} />}
                  {selectedClient.cnpj && <Field label="CNPJ" value={selectedClient.cnpj} />}
                  {selectedClient.email && <Field label="E-mail" value={selectedClient.email} />}
                  {selectedClient.phone && <Field label="Telefone" value={selectedClient.phone} />}
                  {selectedClient.address && <Field label="Endereço" value={selectedClient.address} />}
                </div>
              )}
            </div>

            {/* Center: items + extras */}
            <div className="col-span-12 lg:col-span-6 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-3 flex items-center gap-3 flex-wrap">
                <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-[180px]">
                  <Label className="text-xs font-semibold uppercase text-primary">Data do pedido</Label>
                  <p className="text-[11px] text-muted-foreground">Alterar aqui atualiza as contas a pagar/receber vinculadas.</p>
                </div>
                <Input
                  type="date"
                  className="h-9 w-[170px] bg-background"
                  value={order.created_at ? String(order.created_at).slice(0, 10) : ""}
                  onChange={(e) => {
                    const d = e.target.value;
                    if (!d) return;
                    const time = order.created_at ? String(order.created_at).slice(10) : "T00:00:00.000Z";
                    setField({ created_at: `${d}${time}` });
                  }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"></div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Itens</h3>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2 bg-card">
                      <div className="col-span-12 sm:col-span-6">
                        <Label className="text-[10px] uppercase text-muted-foreground">Descrição</Label>
                        <Input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} className="h-8" />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-[10px] uppercase text-muted-foreground">Qtd</Label>
                        <Input type="number" step="0.01" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} className="h-8" />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-[10px] uppercase text-muted-foreground">Valor</Label>
                        <Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} className="h-8" />
                      </div>
                      <div className="col-span-3 sm:col-span-1 text-right text-sm font-semibold">{formatBRL(it.total)}</div>
                      <div className="col-span-1">
                        <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Prazo de entrega</Label>
                  <Input value={order.delivery_time ?? ""} onChange={(e) => setField({ delivery_time: e.target.value })} placeholder="Ex: 15 dias úteis" />
                </div>
                <div>
                  <Label className="text-xs">Forma de pagamento</Label>
                  <Input value={order.payment_terms ?? ""} onChange={(e) => setField({ payment_terms: e.target.value })} placeholder="Ex: 50% + 50%" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea rows={3} value={order.notes ?? ""} onChange={(e) => setField({ notes: e.target.value })} />
              </div>
            </div>

            {/* Right: financial + history */}
            <div className="col-span-12 lg:col-span-3 border-l overflow-y-auto p-4 space-y-4 bg-muted/20">
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1"><Receipt className="h-3.5 w-3.5" /> Financeiro</h3>
                {linkedTx ? (
                  <div className="rounded-md border bg-card p-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-semibold">{formatBRL(linkedTx.amount)}</span></div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={linkedTx.status === "pago" ? "default" : "secondary"}>{linkedTx.status}</Badge>
                    </div>
                    {linkedTx.status !== "pago" && (
                      <Button size="sm" className="w-full" onClick={markTxPaid}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar como pago</Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma conta vinculada. Aprove o pedido para gerar.</p>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Ações</h3>
                <div className="space-y-2">
                  <Button size="sm" variant="outline" className="w-full justify-start" onClick={generatePDF} disabled={order.status === "aprovado"}>
                    <FileText className="h-3.5 w-3.5 mr-2" /> Gerar orçamento (PDF)
                  </Button>
                  <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => currentId ? setSendOpen(true) : toast.error("Salve o pedido primeiro")}>
                    <Send className="h-3.5 w-3.5 mr-2" /> Enviar (WhatsApp / E-mail)
                  </Button>
                  <Button size="sm" className="w-full justify-start" onClick={approve} disabled={order.status === "aprovado"}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Aprovar pedido
                  </Button>
                </div>
              </div>

              <Separator />

              <OrderAttachments orderId={currentId} />

              <Separator />

              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1"><HistoryIcon className="h-3.5 w-3.5" /> Histórico</h3>
                <ScrollArea className="h-64">
                  <div className="space-y-2 pr-2">
                    {logs.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma alteração ainda.</p>}
                    {logs.map((l: any) => (
                      <div key={l.id} className="text-xs border-l-2 border-primary/30 pl-2">
                        <div className="font-medium">{translateAction(l.action)}</div>
                        <div className="text-muted-foreground">{l.profile?.full_name ?? l.profile?.email ?? "—"} · {formatDate(l.created_at)} {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="h-16 border-t px-4 sm:px-6 flex items-center justify-between bg-card shrink-0">
          <div className="text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="ml-2 text-xl font-bold">{formatBRL(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => persist()} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
            <Button variant="secondary" onClick={generatePDF} disabled={order.status === "aprovado"}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
      </DialogContent>
      {currentId && (
        <SendOrderDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          orderId={currentId}
          orderNumber={order.number}
          total={total}
          client={selectedClient ?? null}
        />
      )}
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}

function translateAction(a: string) {
  const map: Record<string, string> = {
    create: "Pedido criado", update: "Pedido atualizado", approve: "Pedido aprovado",
    generate_budget: "Orçamento gerado", delete: "Pedido excluído", mark_paid: "Conta marcada como paga",
  };
  return map[a] ?? a;
}

function ClientPicker({
  value, clients, onChange, onCreated,
}: {
  value: string | null;
  clients: any[];
  onChange: (id: string) => void;
  onCreated: (c: any) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { data, error } = await supabase.from("clients").insert({ user_id: user.id, ...form }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente criado");
    setCreating(false);
    setForm({ name: "", company: "", phone: "", email: "" });
    onCreated(data);
  };

  return (
    <div className="flex gap-2">
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um cliente..." /></SelectTrigger>
        <SelectContent>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` • ${c.company}` : ""}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover open={creating} onOpenChange={setCreating}>
        <PopoverTrigger asChild>
          <Button size="icon" variant="outline" title="Novo cliente"><UserPlus className="h-4 w-4" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-2">
          <h4 className="font-medium text-sm">Novo cliente</h4>
          <Input placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <Input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Button size="sm" className="w-full" onClick={create} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar"}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
