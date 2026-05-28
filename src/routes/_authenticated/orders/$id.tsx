import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileDown, Save, CheckCircle2, ArrowDownCircle, FileText, MessageCircle } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { generateBudgetPDF } from "@/lib/pdf";
import { logActivity } from "@/lib/logs";
import { shortenUrl } from "@/lib/shortener";

export const Route = createFileRoute("/_authenticated/orders/$id")({ component: OrderEditor });

type Item = { id?: string; description: string; quantity: number; unit_price: number; total: number };
type Material = { id?: string; supplier_name: string; description: string; quantity: number; unit_price: number; total: number; due_date: string | null; transaction_id: string | null };

const statusBadge = (s: string) => {
  const map: Record<string, { l: string; v: "default" | "secondary" | "outline" | "destructive" }> = {
    rascunho: { l: "Rascunho", v: "outline" },
    orcamento: { l: "Orçamento gerado", v: "secondary" },
    aprovado: { l: "Aprovado", v: "default" },
    cancelado: { l: "Cancelado", v: "destructive" },
  };
  return map[s] ?? { l: s, v: "outline" as const };
};

function OrderEditor() {
  const { id } = useParams({ from: "/_authenticated/orders/$id" });
  const navigate = useNavigate();
  const isNew = id === "new";
  const [loading, setLoading] = useState(!isNew);
  const [order, setOrder] = useState<any>({ client_id: null, status: "rascunho", delivery_time: "", payment_terms: "", notes: "" });
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [budgetId, setBudgetId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: cls } = await supabase.from("clients").select("id, name, company, cnpj, email, phone").order("name");
      setClients(cls ?? []);
      if (isNew) return;
      const [{ data: o }, { data: its }, { data: mats }, { data: bgt }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).single(),
        supabase.from("order_items").select("*").eq("order_id", id).order("position"),
        supabase.from("order_materials").select("*").eq("order_id", id).order("created_at"),
        supabase.from("budgets").select("id").eq("order_id", id).maybeSingle(),
      ]);
      if (o) setOrder(o);
      if (its && its.length) setItems(its as Item[]);
      if (mats) setMaterials(mats as Material[]);
      if (bgt) setBudgetId(bgt.id);
      setLoading(false);
    })();
  }, [id, isNew]);

  const total = useMemo(() => items.reduce((s, i) => s + Number(i.total || 0), 0), [items]);
  const selectedClient = useMemo(() => clients.find((c) => c.id === order.client_id), [clients, order.client_id]);

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      next.total = Number(next.quantity) * Number(next.unit_price);
      return next;
    }));
  };

  const saveOrder = async (silent = false): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    if (!order.client_id) { toast.error("Selecione um cliente"); return null; }

    let orderId = isNew ? null : (id as string);
    const payload = {
      user_id: user.id,
      client_id: order.client_id,
      status: order.status,
      total,
      delivery_time: order.delivery_time || null,
      payment_terms: order.payment_terms || null,
      notes: order.notes || null,
    };
    if (isNew) {
      const { data, error } = await supabase.from("orders").insert(payload).select().single();
      if (error) { toast.error(error.message); return null; }
      orderId = data.id;
      setOrder(data);
    } else {
      const { error } = await supabase.from("orders").update(payload).eq("id", id);
      if (error) { toast.error(error.message); return null; }
    }

    await supabase.from("order_items").delete().eq("order_id", orderId!);
    const rows = items.filter((i) => i.description).map((i, idx) => ({
      order_id: orderId!, description: i.description, quantity: Number(i.quantity),
      unit_price: Number(i.unit_price), total: Number(i.total), position: idx,
    }));
    if (rows.length) await supabase.from("order_items").insert(rows);

    await logActivity(isNew ? "create" : "update", "order", orderId!, { total });
    if (!silent) toast.success("Pedido salvo");
    if (isNew && orderId) navigate({ to: "/orders/$id", params: { id: orderId } });
    return orderId;
  };

  const generateBudget = async () => {
    const orderId = await saveOrder(true);
    if (!orderId || !selectedClient) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let bId = budgetId;
    const budgetPayload = {
      user_id: user.id,
      order_id: orderId,
      client_name: selectedClient.name,
      client_company: selectedClient.company,
      client_phone: selectedClient.phone,
      client_email: selectedClient.email,
      delivery_time: order.delivery_time,
      payment_terms: order.payment_terms,
      notes: order.notes,
      total,
    };
    if (bId) {
      await supabase.from("budgets").update(budgetPayload).eq("id", bId);
      await supabase.from("budget_items").delete().eq("budget_id", bId);
    } else {
      const { data, error } = await supabase.from("budgets").insert(budgetPayload).select().single();
      if (error) return toast.error(error.message);
      bId = data.id;
      setBudgetId(bId);
    }
    const bi = items.filter((i) => i.description).map((i, idx) => ({
      budget_id: bId!, description: i.description, quantity: Number(i.quantity),
      unit_price: Number(i.unit_price), total: Number(i.total), position: idx,
    }));
    if (bi.length) await supabase.from("budget_items").insert(bi);

    await supabase.from("orders").update({ status: "orcamento" }).eq("id", orderId);
    setOrder((o: any) => ({ ...o, status: "orcamento" }));
    await logActivity("generate_budget", "order", orderId, { budget_id: bId });

    const { data: company } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
    const { data: b } = await supabase.from("budgets").select("*").eq("id", bId!).single();
    await generateBudgetPDF({ ...b!, items: bi } as any, company ?? {});
    toast.success("Orçamento gerado e PDF baixado");
  };

  const sendWhatsApp = async () => {
    const orderId = await saveOrder(true);
    if (!orderId || !selectedClient) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let bId = budgetId;
    const budgetPayload = {
      user_id: user.id,
      order_id: orderId,
      client_name: selectedClient.name,
      client_company: selectedClient.company,
      client_phone: selectedClient.phone,
      client_email: selectedClient.email,
      delivery_time: order.delivery_time,
      payment_terms: order.payment_terms,
      notes: order.notes,
      total,
    };
    if (bId) {
      await supabase.from("budgets").update(budgetPayload).eq("id", bId);
      await supabase.from("budget_items").delete().eq("budget_id", bId);
    } else {
      const { data, error } = await supabase.from("budgets").insert(budgetPayload).select().single();
      if (error) return toast.error(error.message);
      bId = data.id;
      setBudgetId(bId);
    }
    const bi = items.filter((i) => i.description).map((i, idx) => ({
      budget_id: bId!, description: i.description, quantity: Number(i.quantity),
      unit_price: Number(i.unit_price), total: Number(i.total), position: idx,
    }));
    if (bi.length) await supabase.from("budget_items").insert(bi);

    await supabase.from("orders").update({ status: "orcamento" }).eq("id", orderId);
    setOrder((o: any) => ({ ...o, status: "orcamento" }));

    const { data: company } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
    const { data: b } = await supabase.from("budgets").select("*").eq("id", bId!).single();

    toast.info("Gerando link do WhatsApp...");
    try {
      const doc = await generateBudgetPDF({ ...b!, items: bi } as any, company ?? {}, true);
      const blob = doc.output("blob");
      const fileName = `${user.id}/orcamento-${String(b!.number).padStart(5, "0")}-${Date.now()}.pdf`;
      
      const { error: uploadError } = await supabase.storage.from("attachments").upload(fileName, blob, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;
      
      const { data } = await supabase.storage.from("attachments").createSignedUrl(fileName, 60 * 60 * 24 * 30);
      if (!data?.signedUrl) throw new Error("Não foi possível gerar a URL");
      
      const finalUrl = await shortenUrl(data.signedUrl);
      
      let text = `Olá ${selectedClient.name}, tudo bem?\nSegue o link para o orçamento solicitado referente ao Pedido #${String(order.number ?? "").padStart(5, "0")}:\n\n📄 *Orçamento Nº ${String(b!.number).padStart(5, "0")}*\nValor Total: ${formatBRL(total)}\n\nAcesse o PDF aqui: ${finalUrl}\n\nQualquer dúvida, estou à disposição!`;
      
      let phoneStr = selectedClient.phone ? selectedClient.phone.replace(/\D/g, '') : '';
      if (phoneStr && phoneStr.length >= 10 && !phoneStr.startsWith('55')) {
         phoneStr = '55' + phoneStr;
      }
      
      const waUrl = phoneStr 
        ? `https://wa.me/${phoneStr}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
        
      window.open(waUrl, '_blank');
      toast.success("Redirecionando para o WhatsApp...");
    } catch (error: any) {
      toast.error("Erro ao gerar link para WhatsApp: " + error.message);
    }
  };

  const approveOrder = async () => {
    const orderId = await saveOrder(true);
    if (!orderId || !selectedClient) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create accounts receivable
    const { data: tx, error } = await supabase.from("transactions").insert({
      user_id: user.id,
      order_id: orderId,
      name: `Pedido #${String(order.number ?? "").padStart(5, "0")} - ${selectedClient.name}`,
      description: `Recebimento do pedido aprovado`,
      type: "entrada",
      amount: total,
      status: "pendente",
      transaction_date: new Date().toISOString().slice(0, 10),
      due_date: null,
    }).select().single();
    if (error) return toast.error(error.message);

    await supabase.from("orders").update({ status: "aprovado", approved_at: new Date().toISOString() }).eq("id", orderId);
    setOrder((o: any) => ({ ...o, status: "aprovado" }));
    await logActivity("approve", "order", orderId, { transaction_id: tx.id, total });
    toast.success("Pedido aprovado e conta a receber criada");
  };

  const addMaterial = () => setMaterials([...materials, { supplier_name: "", description: "", quantity: 1, unit_price: 0, total: 0, due_date: null, transaction_id: null }]);
  const updateMaterial = (idx: number, patch: Partial<Material>) => {
    setMaterials((arr) => arr.map((m, i) => {
      if (i !== idx) return m;
      const next = { ...m, ...patch };
      next.total = Number(next.quantity) * Number(next.unit_price);
      return next;
    }));
  };
  const removeMaterial = async (idx: number) => {
    const m = materials[idx];
    if (m.id) {
      await supabase.from("order_materials").delete().eq("id", m.id);
      if (m.transaction_id) await supabase.from("transactions").delete().eq("id", m.transaction_id);
    }
    setMaterials(materials.filter((_, i) => i !== idx));
  };
  const saveMaterialAsPayable = async (idx: number) => {
    const m = materials[idx];
    if (!m.description) return toast.error("Descrição do material é obrigatória");
    const orderId = await saveOrder(true);
    if (!orderId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create payable transaction
    const { data: tx, error: txErr } = await supabase.from("transactions").insert({
      user_id: user.id,
      order_id: orderId,
      name: m.supplier_name ? `${m.description} - ${m.supplier_name}` : m.description,
      description: `Compra de material para pedido #${String(order.number ?? "").padStart(5, "0")}`,
      type: "saida",
      amount: Number(m.total),
      status: "pendente",
      transaction_date: new Date().toISOString().slice(0, 10),
      due_date: m.due_date,
    }).select().single();
    if (txErr) return toast.error(txErr.message);

    const matPayload = {
      order_id: orderId,
      supplier_name: m.supplier_name || null,
      description: m.description,
      quantity: Number(m.quantity),
      unit_price: Number(m.unit_price),
      total: Number(m.total),
      due_date: m.due_date,
      transaction_id: tx.id,
    };
    if (m.id) {
      await supabase.from("order_materials").update(matPayload).eq("id", m.id);
    } else {
      const { data: ins } = await supabase.from("order_materials").insert(matPayload).select().single();
      if (ins) {
        setMaterials((arr) => arr.map((x, i) => i === idx ? { ...x, id: ins.id, transaction_id: tx.id } : x));
      }
    }
    toast.success("Material salvo e conta a pagar criada");
  };

  if (loading) return <div className="text-muted-foreground">Carregando...</div>;

  const s = statusBadge(order.status);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold">
              {isNew ? "Novo pedido" : `Pedido #${String(order.number ?? "").padStart(5, "0")}`}
            </h1>
            {!isNew && <Badge variant={s.v}>{s.l}</Badge>}
          </div>
          {!isNew && <p className="text-sm text-muted-foreground">Criado em {formatDate(order.created_at)}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => saveOrder()}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          <Button variant="secondary" onClick={generateBudget} disabled={order.status === "aprovado"}>
            <FileText className="h-4 w-4 mr-1" /> PDF do Orçamento
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={sendWhatsApp} disabled={order.status === "aprovado"}>
            <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
          </Button>
          <Button onClick={approveOrder} disabled={order.status === "aprovado"}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar pedido
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Selecione um cliente *</Label>
            <div className="flex gap-2">
              <Select value={order.client_id ?? ""} onValueChange={(v) => setOrder({ ...order, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` • ${c.company}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button asChild variant="outline"><Link to="/clients">Cadastrar</Link></Button>
            </div>
          </div>
          {selectedClient && (
            <div className="sm:col-span-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3 space-y-1">
              {selectedClient.cnpj && <div><b>CNPJ:</b> {selectedClient.cnpj}</div>}
              {selectedClient.phone && <div><b>Telefone:</b> {selectedClient.phone}</div>}
              {selectedClient.email && <div><b>E-mail:</b> {selectedClient.email}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Itens do pedido</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0, total: 0 }])}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-12 items-end">
              <div className="sm:col-span-6 space-y-1"><Label className="text-xs">Descrição</Label><Input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} /></div>
              <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Qtd</Label><Input type="number" step="0.01" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></div>
              <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Valor unit.</Label><Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} /></div>
              <div className="sm:col-span-1 text-right text-sm font-semibold">{formatBRL(it.total)}</div>
              <div className="sm:col-span-1"><Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
            </div>
          ))}
          <div className="flex justify-end text-lg font-bold pt-3 border-t">
            Total: {formatBRL(total)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Informações adicionais</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Prazo de entrega</Label><Input value={order.delivery_time || ""} onChange={(e) => setOrder({ ...order, delivery_time: e.target.value })} placeholder="Ex: 15 dias úteis" /></div>
          <div className="space-y-2"><Label>Forma de pagamento</Label><Input value={order.payment_terms || ""} onChange={(e) => setOrder({ ...order, payment_terms: e.target.value })} placeholder="Ex: 50% entrada + 50% entrega" /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Textarea rows={3} value={order.notes || ""} onChange={(e) => setOrder({ ...order, notes: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle>Materiais a comprar</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Cada material salvo gera uma conta a pagar automaticamente.</p>
          </div>
          <Button size="sm" variant="outline" onClick={addMaterial} disabled={isNew}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar material
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isNew && <p className="text-sm text-muted-foreground">Salve o pedido antes de adicionar materiais.</p>}
          {!isNew && materials.length === 0 && <p className="text-sm text-muted-foreground">Nenhum material adicionado.</p>}
          {materials.map((m, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-12 items-end border rounded-md p-3">
              <div className="sm:col-span-3 space-y-1"><Label className="text-xs">Fornecedor</Label><Input value={m.supplier_name} onChange={(e) => updateMaterial(idx, { supplier_name: e.target.value })} /></div>
              <div className="sm:col-span-3 space-y-1"><Label className="text-xs">Descrição</Label><Input value={m.description} onChange={(e) => updateMaterial(idx, { description: e.target.value })} /></div>
              <div className="sm:col-span-1 space-y-1"><Label className="text-xs">Qtd</Label><Input type="number" step="0.01" value={m.quantity} onChange={(e) => updateMaterial(idx, { quantity: Number(e.target.value) })} /></div>
              <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Valor unit.</Label><Input type="number" step="0.01" value={m.unit_price} onChange={(e) => updateMaterial(idx, { unit_price: Number(e.target.value) })} /></div>
              <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Vencimento</Label><Input type="date" value={m.due_date ?? ""} onChange={(e) => updateMaterial(idx, { due_date: e.target.value || null })} /></div>
              <div className="sm:col-span-1 flex flex-col items-end gap-1">
                <span className="text-sm font-semibold">{formatBRL(m.total)}</span>
                {m.transaction_id && <Badge variant="secondary" className="text-[10px]">conta criada</Badge>}
              </div>
              <div className="sm:col-span-12 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => removeMaterial(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                <Button size="sm" onClick={() => saveMaterialAsPayable(idx)}>
                  <ArrowDownCircle className="h-4 w-4 mr-1" /> {m.transaction_id ? "Atualizar conta a pagar" : "Salvar e gerar conta a pagar"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
