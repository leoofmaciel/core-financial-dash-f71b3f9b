import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Mail, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { generateBudgetPDF } from "@/lib/pdf";
import { logActivity } from "@/lib/logs";
import { shortenUrl } from "@/lib/shortener";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string;
  orderNumber?: number | null;
  total: number;
  client: { name?: string | null; email?: string | null; phone?: string | null } | null;
  pdfUrl?: string | null;
};

const defaultWhatsTemplate = (vars: { name: string; number: string; total: string; pdf?: string | null }) =>
  `Olá ${vars.name}! 👋\n\nSegue o orçamento *${vars.number}* no valor de *${vars.total}*.\n${vars.pdf ? `\nPDF: ${vars.pdf}\n` : ""}\nFico à disposição para qualquer dúvida.`;

const defaultEmailSubject = (n: string) => `Orçamento ${n}`;
const defaultEmailBody = (vars: { name: string; number: string; total: string; pdf?: string | null }) =>
  `Olá ${vars.name},\n\nSegue em anexo o orçamento ${vars.number} no valor de ${vars.total}.\n${vars.pdf ? `\nLink do PDF: ${vars.pdf}\n` : ""}\nAtenciosamente.`;

export function SendOrderDialog({ open, onOpenChange, orderId, orderNumber, total, client, pdfUrl }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"whatsapp" | "email">("whatsapp");
  const [phone, setPhone] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const number = `#${String(orderNumber ?? "").padStart(5, "0")}`;
    const vars = { name: client?.name ?? "", number, total: formatBRL(total), pdf: pdfUrl || "[Gerando link do PDF... aguarde]" };
    setPhone(client?.phone ?? "");
    setEmail(client?.email ?? "");
    setWaMsg(defaultWhatsTemplate(vars));
    setSubject(defaultEmailSubject(number));
    setEmailBody(defaultEmailBody(vars));
    
    if (!pdfUrl && open) {
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data: company } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
          const { data: b } = await supabase.from("budgets").select("*").eq("order_id", orderId).maybeSingle();
          
          if (!b) return; // Order hasn't been generated into a budget yet
          
          const { data: bi } = await supabase.from("budget_items").select("*").eq("budget_id", b.id).order("position");
          
          const doc = await generateBudgetPDF({ ...b, items: bi || [] } as any, company ?? {}, true);
          const blob = doc.output("blob");
          const fileName = `${user.id}/orcamento-${String(b.number).padStart(5, "0")}-${Date.now()}.pdf`;
          
          const { error: uploadError } = await supabase.storage.from("attachments").upload(fileName, blob, { contentType: "application/pdf", upsert: true });
          if (uploadError) throw uploadError;
          
          const { data } = await supabase.storage.from("attachments").createSignedUrl(fileName, 60 * 60 * 24 * 30);
          if (data?.signedUrl) {
             const finalUrl = await shortenUrl(data.signedUrl);
             
             setWaMsg(prev => prev.replace("[Gerando link do PDF... aguarde]", finalUrl));
             setEmailBody(prev => prev.replace("[Gerando link do PDF... aguarde]", finalUrl));
          }
        } catch (err) {
           console.error("Error generating pdf link in dialog", err);
           setWaMsg(prev => prev.replace("[Gerando link do PDF... aguarde]", "[Erro ao gerar link]"));
           setEmailBody(prev => prev.replace("[Gerando link do PDF... aguarde]", "[Erro ao gerar link]"));
        }
      })();
    }
  }, [open, orderId, orderNumber, total, client, pdfUrl]);

  const log = async (channel: "whatsapp" | "email", recipient: string, body: string, subj?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase.from("order_communications" as any).insert({
      order_id: orderId, user_id: user.id, channel, recipient,
      subject: subj ?? null, body, pdf_url: pdfUrl ?? null, status: "sent",
    }));
    await supabase.from("orders").update({ status: "orcamento_enviado" as any }).eq("id", orderId);
    await logActivity("send_" + channel, "order", orderId, { recipient });
    qc.invalidateQueries({ queryKey: ["order-comms", orderId] });
    qc.invalidateQueries({ queryKey: ["order-logs", orderId] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const sendWhats = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return toast.error("Telefone inválido");
    setBusy(true);
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    const url = `https://wa.me/${num}?text=${encodeURIComponent(waMsg)}`;
    window.open(url, "_blank");
    await log("whatsapp", phone, waMsg);
    setBusy(false);
    toast.success("WhatsApp aberto e envio registrado");
    onOpenChange(false);
  };

  const sendEmail = async () => {
    if (!email.includes("@")) return toast.error("E-mail inválido");
    setBusy(true);
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = url;
    await log("email", email, emailBody, subject);
    setBusy(false);
    toast.success("E-mail preparado e envio registrado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar orçamento</DialogTitle>
          <DialogDescription>Envie o orçamento ao cliente por WhatsApp ou e-mail. O envio fica registrado no histórico.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="whatsapp"><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</TabsTrigger>
            <TabsTrigger value="email"><Mail className="h-4 w-4 mr-1" /> E-mail</TabsTrigger>
          </TabsList>
          <TabsContent value="whatsapp" className="space-y-3 pt-3">
            <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="51 99999-9999" /></div>
            <div><Label>Mensagem</Label><Textarea rows={8} value={waMsg} onChange={(e) => setWaMsg(e.target.value)} /></div>
          </TabsContent>
          <TabsContent value="email" className="space-y-3 pt-3">
            <div><Label>Destinatário</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Assunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div><Label>Mensagem</Label><Textarea rows={6} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} /></div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {tab === "whatsapp" ? (
            <Button onClick={sendWhats} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Abrir WhatsApp</>}</Button>
          ) : (
            <Button onClick={sendEmail} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Abrir e-mail</>}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
