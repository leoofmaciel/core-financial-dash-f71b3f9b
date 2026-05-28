import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, FileDown, Save, Mail, Link as LinkIcon } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { generateBudgetPDF } from "@/lib/pdf";
import { logActivity } from "@/lib/logs";
import { shortenUrl } from "@/lib/shortener";

export const Route = createFileRoute("/_authenticated/budgets/$id")({ component: BudgetEditor });

type Item = { id?: string; description: string; quantity: number; unit_price: number; total: number };

function BudgetEditor() {
  const { id } = useParams({ from: "/_authenticated/budgets/$id" });
  const navigate = useNavigate();
  const isNew = id === "new";
  const [loading, setLoading] = useState(!isNew);
  const [budget, setBudget] = useState<any>({
    client_name: "", client_company: "", client_phone: "", client_email: "",
    delivery_time: "", payment_terms: "", notes: "",
  });
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const [{ data: b }, { data: its }] = await Promise.all([
        supabase.from("budgets").select("*").eq("id", id).single(),
        supabase.from("budget_items").select("*").eq("budget_id", id).order("position"),
      ]);
      if (b) setBudget(b);
      if (its) setItems(its);
      setLoading(false);
    })();
  }, [id, isNew]);

  const total = items.reduce((s, i) => s + Number(i.total || 0), 0);

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      next.total = Number(next.quantity) * Number(next.unit_price);
      return next;
    }));
  };

  const save = async (then?: "pdf" | "back" | "email" | "link" | "whatsapp") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!budget.client_name) return toast.error("Nome do cliente é obrigatório");

    let budgetId = isNew ? null : id;
    if (isNew) {
      const { data, error } = await supabase.from("budgets").insert({
        user_id: user.id, ...budget, total,
      }).select().single();
      if (error) return toast.error(error.message);
      budgetId = data.id;
      setBudget(data);
    } else {
      const { error } = await supabase.from("budgets").update({ ...budget, total }).eq("id", id);
      if (error) return toast.error(error.message);
    }

    // Replace items
    await supabase.from("budget_items").delete().eq("budget_id", budgetId!);
    const rows = items.filter((i) => i.description).map((i, idx) => ({
      budget_id: budgetId!, description: i.description, quantity: Number(i.quantity),
      unit_price: Number(i.unit_price), total: Number(i.total), position: idx,
    }));
    if (rows.length) await supabase.from("budget_items").insert(rows);

    await logActivity(isNew ? "create" : "update", "budget", budgetId!, { client: budget.client_name, total });
    toast.success("Orçamento salvo");

    if (then === "pdf" || then === "email" || then === "link" || then === "whatsapp") {
      const { data: company } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
      const { data: b } = await supabase.from("budgets").select("*").eq("id", budgetId!).single();
      
      if (then === "pdf") {
        await generateBudgetPDF({ ...b!, items: rows } as any, company ?? {});
      } else if (then === "email") {
        setIsProcessing(true);
        try {
          const accessToken = localStorage.getItem("gmail_access_token");
          if (!accessToken) {
            toast.error("Você precisa conectar seu Gmail nas Configurações primeiro.");
            setIsProcessing(false);
            return;
          }
          if (!budget.client_email) {
            toast.error("O e-mail do cliente não foi preenchido.");
            setIsProcessing(false);
            return;
          }
          
          const doc = await generateBudgetPDF({ ...b!, items: rows } as any, company ?? {}, true);
          const pdfDataUrl = doc.output("datauristring");
          
          const { sendGmail } = await import("@/lib/gmail");
          await sendGmail(
            accessToken,
            budget.client_email,
            `Orçamento #${String(budget.number ?? b!.number).padStart(5, "0")} - ${company?.company_name || "Nossa Empresa"}`,
            `Olá ${budget.client_name},\n\nSegue em anexo o orçamento solicitado.\n\nAtenciosamente,\n${company?.company_name || "Nossa Empresa"}`,
            [{ name: `Orcamento-${String(budget.number ?? b!.number).padStart(5, "0")}.pdf`, dataUrl: pdfDataUrl }]
          );
          toast.success("E-mail enviado com sucesso!");
        } catch (error: any) {
          toast.error("Erro ao enviar e-mail: " + error.message);
        }
        setIsProcessing(false);
      } else if (then === "link") {
        setIsProcessing(true);
        try {
          const doc = await generateBudgetPDF({ ...b!, items: rows } as any, company ?? {}, true);
          const blob = doc.output("blob");
          const fileName = `${user.id}/orcamento-${String(budget.number ?? b!.number).padStart(5, "0")}-${Date.now()}.pdf`;
          
          const { error: uploadError } = await supabase.storage.from("attachments").upload(fileName, blob, { contentType: "application/pdf", upsert: true });
          if (uploadError) throw uploadError;
          
          const { data } = await supabase.storage.from("attachments").createSignedUrl(fileName, 60 * 60 * 24 * 30); // 30 dias
          if (!data?.signedUrl) throw new Error("Não foi possível gerar a URL");
          
          const finalUrl = await shortenUrl(data.signedUrl);
          
          await navigator.clipboard.writeText(finalUrl);
          toast.success("Link gerado e copiado para a área de transferência!");
        } catch (error: any) {
          toast.error("Erro ao gerar link: " + error.message);
        }
        setIsProcessing(false);
      } else if (then === "whatsapp") {
        setIsProcessing(true);
        try {
          const doc = await generateBudgetPDF({ ...b!, items: rows } as any, company ?? {}, true);
          const blob = doc.output("blob");
          const fileName = `${user.id}/orcamento-${String(budget.number ?? b!.number).padStart(5, "0")}-${Date.now()}.pdf`;
          
          const { error: uploadError } = await supabase.storage.from("attachments").upload(fileName, blob, { contentType: "application/pdf", upsert: true });
          if (uploadError) throw uploadError;
          
          const { data } = await supabase.storage.from("attachments").createSignedUrl(fileName, 60 * 60 * 24 * 30); // 30 dias
          if (!data?.signedUrl) throw new Error("Não foi possível gerar a URL");
          
          const finalUrl = await shortenUrl(data.signedUrl);
          
          let text = `Olá ${budget.client_name}, tudo bem?\nSegue o link para o orçamento solicitado:\n\n📄 *Orçamento Nº ${String(budget.number ?? b!.number).padStart(5, "0")}*\nValor Total: ${formatBRL(total)}\n\nAcesse o PDF aqui: ${finalUrl}\n\nQualquer dúvida, estou à disposição!`;
          
          let phoneStr = budget.client_phone ? budget.client_phone.replace(/\D/g, '') : '';
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
        setIsProcessing(false);
      }
    }
    if (then === "back" || isNew) navigate({ to: "/budgets" });
  };

  if (loading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{isNew ? "Novo orçamento" : `Orçamento #${String(budget.number ?? "").padStart(5, "0")}`}</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados do cliente e itens.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save("back")}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          <Button onClick={() => save("pdf")}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
          <Button variant="secondary" onClick={() => save("link")} disabled={isProcessing}>
            <LinkIcon className="h-4 w-4 mr-1" /> {isProcessing ? "Gerando..." : "Gerar Link"}
          </Button>
          <Button variant="secondary" onClick={() => save("email")} disabled={isProcessing}>
            <Mail className="h-4 w-4 mr-1" /> E-mail
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => save("whatsapp")} disabled={isProcessing}>
            <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados do cliente</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Nome *</Label><Input value={budget.client_name || ""} onChange={(e) => setBudget({ ...budget, client_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Empresa</Label><Input value={budget.client_company || ""} onChange={(e) => setBudget({ ...budget, client_company: e.target.value })} /></div>
          <div className="space-y-2"><Label>Telefone</Label><Input value={budget.client_phone || ""} onChange={(e) => setBudget({ ...budget, client_phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={budget.client_email || ""} onChange={(e) => setBudget({ ...budget, client_email: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Itens</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0, total: 0 }])}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
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
          <div className="space-y-2"><Label>Prazo de entrega</Label><Input value={budget.delivery_time || ""} onChange={(e) => setBudget({ ...budget, delivery_time: e.target.value })} placeholder="Ex: 15 dias úteis" /></div>
          <div className="space-y-2"><Label>Forma de pagamento</Label><Input value={budget.payment_terms || ""} onChange={(e) => setBudget({ ...budget, payment_terms: e.target.value })} placeholder="Ex: 50% entrada + 50% entrega" /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Textarea rows={3} value={budget.notes || ""} onChange={(e) => setBudget({ ...budget, notes: e.target.value })} /></div>
        </CardContent>
      </Card>
    </div>
  );
}
