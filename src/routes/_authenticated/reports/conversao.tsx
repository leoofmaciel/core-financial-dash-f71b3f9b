import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { formatDate } from "@/lib/format";
import { ArrowLeft, Download, FileText, CheckCircle, XCircle } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports/conversao")({
  component: ConversaoReport,
});

function ConversaoReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().split("T")[0];
  });

  const company = useCompanySettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders_reports", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", `${startDate}T00:00:00Z`)
        .lte("created_at", `${endDate}T23:59:59Z`);
      return data || [];
    },
  });

  const totalOrcamentos = orders.length;
  const aprovados = orders.filter(o => o.status === "aprovado" || o.status === "faturado").length;
  const rejeitados = orders.filter(o => o.status === "cancelado").length;
  const pendentes = orders.filter(o => o.status === "rascunho" || o.status === "enviado").length;
  const taxaConversao = totalOrcamentos > 0 ? Math.round((aprovados / totalOrcamentos) * 100) : 0;

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
      pdf.text("TAXA DE CONVERSÃO", pageW - margin, 20, { align: "right" });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfInnerW = pageW - margin * 2;
      const pdfInnerH = (imgProps.height * pdfInnerW) / imgProps.width;
      pdf.addImage(imgData, "PNG", margin, headerH + 10, pdfInnerW, pdfInnerH);
      pdf.save(`Taxa_de_Conversao.pdf`);
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
          <h1 className="text-2xl font-bold flex items-center gap-2">Desempenho Comercial (Conversão)</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><label className="text-xs">Data Inicial</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-[130px]" /></div>
          <div className="space-y-1"><label className="text-xs">Data Final</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[130px]" /></div>
          <Button onClick={exportPDF} className="h-9"><Download className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </div>
      <div ref={reportRef} className="space-y-6 bg-white p-6 rounded-xl border">
        <div className="flex flex-col items-center justify-center p-8 bg-blue-50/50 rounded-2xl border border-blue-100">
          <h2 className="text-lg font-medium text-slate-700 mb-2">Sua Taxa de Aprovação é de</h2>
          <div className="text-7xl font-black text-blue-600 mb-4">{taxaConversao}%</div>
          <div className="w-full max-w-lg bg-slate-200 h-4 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full transition-all" style={{ width: `${taxaConversao}%` }}></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <FileText className="h-8 w-8 text-slate-400 mb-3" />
              <p className="text-3xl font-bold text-slate-800">{totalOrcamentos}</p>
              <p className="text-sm font-medium text-muted-foreground mt-1">Gerados Totais</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center border-b-4 border-b-green-500">
              <CheckCircle className="h-8 w-8 text-green-500 mb-3" />
              <p className="text-3xl font-bold text-green-600">{aprovados}</p>
              <p className="text-sm font-medium text-muted-foreground mt-1">Aprovados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center border-b-4 border-b-red-500">
              <XCircle className="h-8 w-8 text-red-500 mb-3" />
              <p className="text-3xl font-bold text-red-600">{rejeitados}</p>
              <p className="text-sm font-medium text-muted-foreground mt-1">Rejeitados/Cancelados</p>
            </CardContent>
          </Card>
        </div>

        {pendentes > 0 && (
          <div className="bg-orange-50 text-orange-800 p-4 rounded-lg border border-orange-200 text-center">
            <p className="font-medium">Você possui <strong>{pendentes}</strong> orçamentos aguardando resposta do cliente neste período.</p>
          </div>
        )}
      </div>
    </div>
  );
}
