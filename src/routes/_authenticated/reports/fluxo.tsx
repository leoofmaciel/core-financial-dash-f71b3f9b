import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { formatBRL, formatDate } from "@/lib/format";
import { ArrowLeft, Download, DollarSign, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports/fluxo")({
  component: FluxoCaixaReport,
});

function FluxoCaixaReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().split("T")[0];
  });

  const company = useCompanySettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").gte("transaction_date", startDate).lte("transaction_date", endDate);
      return data || [];
    },
  });

  let aReceber = 0;
  let aPagar = 0;
  let recebido = 0;
  let pago = 0;

  transactions.forEach(t => {
    if (t.status === "pendente") {
      if (t.type === "entrada") aReceber += t.amount;
      else aPagar += t.amount;
    } else if (t.status === "pago") {
      if (t.type === "entrada") recebido += t.amount;
      else pago += t.amount;
    }
  });

  const saldoPrevisto = aReceber - aPagar;

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const toastId = toast.loading("Gerando PDF...");
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 14; const headerH = 35;
      pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, pageW, headerH, "F");
      pdf.setFillColor(29, 78, 216); pdf.triangle(pageW * 0.4, 0, pageW, 0, pageW, headerH, "F");
      pdf.setTextColor(255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
      pdf.text(company?.company_name || "Relatório", margin, 16);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
      pdf.text(`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`, margin, 22);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(18);
      pdf.text("PREVISÃO DE FLUXO", pageW - margin, 20, { align: "right" });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfInnerW = pageW - margin * 2;
      const pdfInnerH = (imgProps.height * pdfInnerW) / imgProps.width;
      pdf.addImage(imgData, "PNG", margin, headerH + 10, pdfInnerW, pdfInnerH);
      pdf.save(`Previsao_Fluxo_Caixa.pdf`);
      toast.success("PDF baixado!", { id: toastId });
    } catch { toast.error("Erro", { id: toastId }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <Link to="/reports" className="text-muted-foreground flex items-center text-sm hover:text-primary mb-1">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar aos relatórios
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">Previsão de Fluxo de Caixa</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><label className="text-xs">Data Inicial</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-[130px]" /></div>
          <div className="space-y-1"><label className="text-xs">Data Final</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[130px]" /></div>
          <Button onClick={exportPDF} className="h-9"><Download className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </div>
      <div ref={reportRef} className="space-y-6 bg-white p-6 rounded-xl border">
        
        <div className="bg-slate-50 p-6 rounded-xl border flex flex-col items-center justify-center text-center">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-2">Saldo das Contas Pendentes</h2>
          <div className={`text-6xl font-black ${saldoPrevisto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatBRL(saldoPrevisto)}
          </div>
          <p className="text-sm text-muted-foreground mt-4 max-w-md">
            Este valor representa a diferença entre o que você tem a receber e o que tem a pagar no período selecionado, caso tudo seja pago nas datas combinadas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card className="border-green-100 bg-green-50/20 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-green-800">
                <ArrowDownCircle className="h-5 w-5" /> Entradas Previstas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendente a Receber</p>
                  <p className="text-3xl font-bold text-green-600">{formatBRL(aReceber)}</p>
                </div>
                <div className="pt-4 border-t border-green-100">
                  <p className="text-xs text-muted-foreground">Já recebido no período: <span className="font-semibold text-slate-700">{formatBRL(recebido)}</span></p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-100 bg-red-50/20 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-red-800">
                <ArrowUpCircle className="h-5 w-5" /> Saídas Previstas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendente a Pagar</p>
                  <p className="text-3xl font-bold text-red-600">{formatBRL(aPagar)}</p>
                </div>
                <div className="pt-4 border-t border-red-100">
                  <p className="text-xs text-muted-foreground">Já pago no período: <span className="font-semibold text-slate-700">{formatBRL(pago)}</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
