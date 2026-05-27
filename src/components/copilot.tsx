import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles, ArrowRight, ArrowLeft, Check, Plus, Trash2, FileDown,
  UserPlus, UserCheck, FileText, CheckCircle2, Wallet, PartyPopper, Loader2, X,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { generateBudgetPDF } from "@/lib/pdf";
import { logActivity } from "@/lib/logs";
import { cn } from "@/lib/utils";

type Client = { id: string; name: string; company: string | null; cnpj: string | null; email: string | null; phone: string | null };
type Item = { description: string; quantity: number; unit_price: number; total: number };

const STEPS = [
  { key: "client", label: "Cliente", icon: UserCheck },
  { key: "order", label: "Pedido", icon: FileText },
  { key: "budget", label: "Orçamento", icon: FileDown },
  { key: "approve", label: "Aprovação", icon: CheckCircle2 },
  { key: "payment", label: "Pagamento", icon: Wallet },
] as const;

const emptyClient = { name: "", company: "", cnpj: "", email: "", phone: "" };

export function Copilot() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // step 1 - client
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [newClient, setNewClient] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClient);
  const [client, setClient] = useState<Client | null>(null);

  // step 2 - order
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
  const [delivery, setDelivery] = useState("");
  const [payment, setPayment] = useState("");
  const [notes, setNotes] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  // step 3 - budget
  const [budgetId, setBudgetId] = useState<string | null>(null);

  // step 4/5 - receivable
  const [txId, setTxId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");

  const total = useMemo(() => items.reduce((s, i) => s + Number(i.total || 0), 0), [items]);

  useEffect(() => {
    if (!open) return;
    supabase.from("clients").select("id, name, company, cnpj, email, phone").order("name").then(({ data }) => {
      setClients(data ?? []);
    });
  }, [open]);

  const reset = () => {
    setStep(0); setNewClient(false); setClient(null); setClientForm(emptyClient); setSearch("");
    setItems([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
    setDelivery(""); setPayment(""); setNotes("");
    setOrderId(null); setOrderNumber(null); setBudgetId(null); setTxId(null); setDueDate("");
  };

  const filtered = clients.filter((c) => {
    const s = search.toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || (c.company ?? "").toLowerCase().includes(s);
  });

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      next.total = Number(next.quantity) * Number(next.unit_price);
      return next;
    }));
  };

  // ---- actions ----
  const saveNewClient = async () => {
    if (!clientForm.name.trim()) return toast.error("Nome é obrigatório");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("clients").insert({ ...clientForm, user_id: user.id }).select().single();
      if (error) throw error;
      await logActivity("create", "client", data.id, { name: data.name });
      setClient(data as Client);
      setClients((c) => [...c, data as Client]);
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente cadastrado");
      setStep(1);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const createOrder = async () => {
    if (!client) return;
    if (items.filter((i) => i.description).length === 0) return toast.error("Adicione ao menos um item");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: o, error } = await supabase.from("orders").insert({
        user_id: user.id, client_id: client.id, status: "rascunho", total,
        delivery_time: delivery || null, payment_terms: payment || null, notes: notes || null,
      }).select().single();
      if (error) throw error;
      const rows = items.filter((i) => i.description).map((i, idx) => ({
        order_id: o.id, description: i.description, quantity: Number(i.quantity),
        unit_price: Number(i.unit_price), total: Number(i.total), position: idx,
      }));
      if (rows.length) await supabase.from("order_items").insert(rows);
      setOrderId(o.id); setOrderNumber(o.number);
      await logActivity("create", "order", o.id, { total });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Pedido #${String(o.number).padStart(5, "0")} criado`);
      setStep(2);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const generateBudget = async () => {
    if (!orderId || !client) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: b, error } = await supabase.from("budgets").insert({
        user_id: user.id, order_id: orderId,
        client_name: client.name, client_company: client.company, client_phone: client.phone, client_email: client.email,
        delivery_time: delivery, payment_terms: payment, notes, total,
      }).select().single();
      if (error) throw error;
      const bi = items.filter((i) => i.description).map((i, idx) => ({
        budget_id: b.id, description: i.description, quantity: Number(i.quantity),
        unit_price: Number(i.unit_price), total: Number(i.total), position: idx,
      }));
      if (bi.length) await supabase.from("budget_items").insert(bi);
      await supabase.from("orders").update({ status: "orcamento" }).eq("id", orderId);
      setBudgetId(b.id);

      const { data: company } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
      await generateBudgetPDF({ ...b, items: bi } as any, company ?? {});
      await logActivity("generate_budget", "order", orderId, { budget_id: b.id });
      toast.success("Orçamento gerado e PDF baixado");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const approveOrder = async () => {
    if (!orderId || !client) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: tx, error } = await supabase.from("transactions").insert({
        user_id: user.id, order_id: orderId,
        name: `Pedido #${String(orderNumber ?? "").padStart(5, "0")} - ${client.name}`,
        description: "Recebimento do pedido aprovado",
        type: "entrada", amount: total, status: "pendente",
        transaction_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate || null, payment_method: payment || null,
      }).select().single();
      if (error) throw error;
      await supabase.from("orders").update({ status: "aprovado", approved_at: new Date().toISOString() }).eq("id", orderId);
      setTxId(tx.id);
      await logActivity("approve", "order", orderId, { transaction_id: tx.id, total });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Pedido aprovado — conta a receber criada");
      setStep(4);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const markPaid = async () => {
    if (!txId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("transactions").update({
        status: "pago", transaction_date: new Date().toISOString().slice(0, 10),
      }).eq("id", txId);
      if (error) throw error;
      await logActivity("payment", "transaction", txId, { amount: total });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pagamento registrado!");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  // ---- UI ----
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 transition-transform flex items-center justify-center group"
        aria-label="Abrir copiloto"
      >
        <Sparkles className="h-6 w-6" />
        <span className="absolute right-full mr-3 px-2 py-1 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Copiloto de vendas
        </span>
      </button>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="p-5 border-b bg-gradient-to-br from-primary/10 to-transparent">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <SheetTitle>Copiloto de vendas</SheetTitle>
                <SheetDescription className="text-xs">Do cliente ao pagamento em poucos passos</SheetDescription>
              </div>
            </div>
            {/* stepper */}
            <div className="flex items-center justify-between gap-1 pt-3">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = i < step;
                const active = i === step;
                return (
                  <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                      done && "bg-primary text-primary-foreground",
                      active && "bg-primary/15 text-primary ring-2 ring-primary",
                      !done && !active && "bg-muted text-muted-foreground",
                    )}>
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={cn("text-[10px] text-center leading-tight", active ? "text-foreground font-medium" : "text-muted-foreground")}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {step === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Comece selecionando o cliente do pedido.</p>
                {!newClient && !client && (
                  <>
                    <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    <div className="max-h-72 overflow-y-auto space-y-1 border rounded-md p-1">
                      {filtered.map((c) => (
                        <button key={c.id} onClick={() => setClient(c)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-accent text-sm">
                          <div className="font-medium">{c.name}</div>
                          {c.company && <div className="text-xs text-muted-foreground">{c.company}</div>}
                        </button>
                      ))}
                      {filtered.length === 0 && <p className="text-sm text-muted-foreground p-3 text-center">Nenhum cliente encontrado.</p>}
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => setNewClient(true)}>
                      <UserPlus className="h-4 w-4 mr-2" /> Cadastrar novo cliente
                    </Button>
                  </>
                )}

                {newClient && !client && (
                  <Card><CardContent className="pt-4 space-y-3">
                    <div className="space-y-1"><Label>Nome *</Label><Input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Empresa</Label><Input value={clientForm.company} onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label>CNPJ</Label><Input value={clientForm.cnpj} onChange={(e) => setClientForm({ ...clientForm, cnpj: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Telefone</Label><Input value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} /></div>
                    </div>
                    <div className="space-y-1"><Label>E-mail</Label><Input value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} /></div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setNewClient(false)}>Voltar</Button>
                      <Button className="flex-1" onClick={saveNewClient} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Salvar e continuar</>}
                      </Button>
                    </div>
                  </CardContent></Card>
                )}

                {client && (
                  <Card className="border-primary/40 bg-primary/5">
                    <CardContent className="pt-4 flex items-center gap-3">
                      <UserCheck className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-medium">{client.name}</div>
                        {client.company && <div className="text-xs text-muted-foreground">{client.company}</div>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setClient(null)}><X className="h-4 w-4" /></Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Preencha os itens do pedido para <b>{client?.name}</b>.</p>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <Card key={idx}><CardContent className="pt-3 grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-12 space-y-1"><Label className="text-xs">Descrição</Label><Input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} /></div>
                      <div className="col-span-4 space-y-1"><Label className="text-xs">Qtd</Label><Input type="number" step="0.01" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></div>
                      <div className="col-span-4 space-y-1"><Label className="text-xs">Valor unit.</Label><Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} /></div>
                      <div className="col-span-3 text-right text-sm font-semibold pb-2">{formatBRL(it.total)}</div>
                      <div className="col-span-1"><Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                    </CardContent></Card>
                  ))}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0, total: 0 }])}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar item
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Prazo de entrega</Label><Input value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="15 dias úteis" /></div>
                  <div className="space-y-1"><Label className="text-xs">Forma de pagamento</Label><Input value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="50/50" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Observações</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-xl font-bold">{formatBRL(total)}</span>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 text-center py-4">
                <div className="h-16 w-16 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Pedido #{String(orderNumber ?? "").padStart(5, "0")} criado</h3>
                  <p className="text-sm text-muted-foreground">Gere o orçamento em PDF para enviar ao cliente.</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-sm text-left space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span>{client?.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Itens</span><span>{items.filter((i) => i.description).length}</span></div>
                  <div className="flex justify-between font-semibold"><span>Total</span><span>{formatBRL(total)}</span></div>
                </div>
                {!budgetId ? (
                  <Button className="w-full" onClick={generateBudget} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4 mr-2" /> Gerar orçamento em PDF</>}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Orçamento gerado</Badge>
                    <Button variant="outline" className="w-full" onClick={generateBudget} disabled={loading}>
                      <FileDown className="h-4 w-4 mr-2" /> Baixar novamente
                    </Button>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-lg">Cliente aprovou?</h3>
                  <p className="text-sm text-muted-foreground">Aprove o pedido para gerar a conta a receber automaticamente.</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data de vencimento (opcional)</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <Button className="w-full" onClick={approveOrder} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar pedido</>}
                </Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="h-16 w-16 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
                    <Wallet className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Conta a receber criada</h3>
                  <p className="text-sm text-muted-foreground">Quando o cliente pagar, marque abaixo para dar baixa automaticamente.</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span>{client?.name}</span></div>
                  <div className="flex justify-between font-semibold"><span>Valor</span><span>{formatBRL(total)}</span></div>
                  {dueDate && <div className="flex justify-between"><span className="text-muted-foreground">Vencimento</span><span>{dueDate}</span></div>}
                </div>
                <Button className="w-full" onClick={markPaid} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-2" /> Marcar como pago</>}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => { reset(); toast.success("Pronto para o próximo!"); }}>
                  <PartyPopper className="h-4 w-4 mr-2" /> Iniciar novo fluxo
                </Button>
              </div>
            )}
          </div>

          {/* navigation footer */}
          <div className="border-t p-4 flex gap-2 bg-background">
            <Button variant="ghost" disabled={step === 0 || loading} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <div className="flex-1" />
            {step === 0 && client && (
              <Button onClick={() => setStep(1)}>Continuar <ArrowRight className="h-4 w-4 ml-1" /></Button>
            )}
            {step === 1 && (
              <Button onClick={createOrder} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Criar pedido <ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>
            )}
            {step === 2 && budgetId && (
              <Button onClick={() => setStep(3)}>Continuar <ArrowRight className="h-4 w-4 ml-1" /></Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
