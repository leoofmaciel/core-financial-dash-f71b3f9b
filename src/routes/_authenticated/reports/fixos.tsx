import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { formatBRL, formatDate } from "@/lib/format";
import { ArrowLeft, Download, Zap, Home, FileText } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports/fixos")({
  component: CustosFixosReport,
});

function CustosFixosReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().split("T")[0];
  });

  const company = useCompanySettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions_fixos", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*, categories(name)").gte("transaction_date", startDate).lte("transaction_date", endDate).eq("type", "saida").eq("status", "pago");
      return data || [];
    },
  });

  const fixedCategories = ["luz", "energia", "água", "agua", "internet", "telefone", "aluguel", "contador", "imposto", "salário", "salario"];
  
  let energia = 0;
  let aluguel = 0;
  let outrosFixos = 0;
  let totalFixos = 0;

  transactions.forEach((t) => {
    const catName = t.categories?.name?.toLowerCase() || "";
    const isFixed = fixedCategories.some(k => catName.includes(k)) || (t.name || "").toLowerCase().includes("luz");
    
    if (isFixed) {
      totalFixos += t.amount;
      if (catName.includes("luz") || catName.includes("energia") || (t.name || "").toLowerCase().includes("luz")) {
        energia += t.amount;
      } else if (catName.includes("aluguel") || (t.name || "").toLowerCase().includes("aluguel")) {
        aluguel += t.amount;
      } else {
        outrosFixos += t.amount;
      }
    }
  });

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
      pdf.text("CUSTOS FIXOS", pageW - margin, 20, { align: "right" });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfInnerW = pageW - margin * 2;
      const pdfInnerH = (imgProps.height * pdfInnerW) / imgProps.width;
      pdf.addImage(imgData, "PNG", margin, headerH + 10, pdfInnerW, pdfInnerH);
      pdf.save(`Custos_Fixos.pdf`);
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
          <h1 className="text-2xl font-bold flex items-center gap-2">Custos Fixos Operacionais</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><label className="text-xs">Data Inicial</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-[130px]" /></div>
          <div className="space-y-1"><label className="text-xs">Data Final</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[130px]" /></div>
          <Button onClick={exportPDF} className="h-9"><Download className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </div>
      
      <div ref={reportRef} className="space-y-6 bg-white p-6 rounded-xl border">
        
        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-200">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-2">Total de Custos Fixos Pagos</h2>
          <div className="text-5xl font-black text-slate-800">{formatBRL(totalFixos)}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-purple-100 bg-purple-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
                <Zap className="h-4 w-4" /> Energia Elétrica
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">{formatBRL(energia)}</div>
              <p className="text-xs text-purple-600/70 mt-1">{totalFixos > 0 ? Math.round((energia/totalFixos)*100) : 0}% do total fixo</p>
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-blue-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                <Home className="h-4 w-4" /> Aluguel / Estrutura
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{formatBRL(aluguel)}</div>
              <p className="text-xs text-blue-600/70 mt-1">{totalFixos > 0 ? Math.round((aluguel/totalFixos)*100) : 0}% do total fixo</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-600">
                <FileText className="h-4 w-4" /> Outros (Contador, Internet...)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{formatBRL(outrosFixos)}</div>
              <p className="text-xs text-muted-foreground mt-1">{totalFixos > 0 ? Math.round((outrosFixos/totalFixos)*100) : 0}% do total fixo</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
