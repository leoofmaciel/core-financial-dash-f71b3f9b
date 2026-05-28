import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { formatBRL, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown, ArrowLeft, Download } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports/faturamento")({
  component: FaturamentoReport,
});

function FaturamentoReport() {
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
      const { data } = await supabase.from("transactions").select("*, categories(name)").gte("transaction_date", startDate).lte("transaction_date", endDate).eq("status", "pago");
      return data || [];
    },
  });

  const rawMaterialCategories = ["aço", "alumínio", "aluminio", "solda", "matéria", "materia", "insumos"];
  let faturamento = 0;
  let custoMP = 0;

  transactions.forEach((t) => {
    if (t.type === "entrada") faturamento += t.amount;
    if (t.type === "saida") {
      const catName = t.categories?.name?.toLowerCase() || "";
      if (rawMaterialCategories.some(k => catName.includes(k))) {
        custoMP += t.amount;
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
      pdf.text("FATURAMENTO VS MP", pageW - margin, 20, { align: "right" });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfInnerW = pageW - margin * 2;
      const pdfInnerH = (imgProps.height * pdfInnerW) / imgProps.width;
      pdf.addImage(imgData, "PNG", margin, headerH + 10, pdfInnerW, pdfInnerH);
      pdf.save(`Faturamento_vs_Custos.pdf`);
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
          <h1 className="text-2xl font-bold flex items-center gap-2">Faturamento vs Custos Matéria-Prima</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><label className="text-xs">Data Inicial</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-[130px]" /></div>
          <div className="space-y-1"><label className="text-xs">Data Final</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[130px]" /></div>
          <Button onClick={exportPDF} className="h-9"><Download className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </div>
      <div ref={reportRef} className="space-y-4 bg-white p-4 rounded-xl border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-green-200 bg-green-50/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-700 rounded-full"><TrendingUp className="h-6 w-6" /></div>
                <div><p className="text-sm text-green-700 font-medium">Faturamento Total (Recebido)</p><h3 className="text-3xl font-bold text-green-800">{formatBRL(faturamento)}</h3></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 text-red-700 rounded-full"><TrendingDown className="h-6 w-6" /></div>
                <div>
                  <p className="text-sm text-red-700 font-medium">Custo Matéria-Prima (Pago)</p>
                  <h3 className="text-3xl font-bold text-red-800">{formatBRL(custoMP)}</h3>
                  <p className="text-xs text-red-600/70 mt-1">Representa {faturamento > 0 ? Math.round((custoMP / faturamento) * 100) : 0}% do faturamento</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Margem Bruta (Apenas Matéria-Prima)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(faturamento - custoMP)}</div>
            <div className="w-full bg-red-100 h-6 rounded-full overflow-hidden mt-4 flex">
              <div className="bg-green-500 h-full" style={{ width: `${faturamento > 0 ? 100 - (custoMP/faturamento)*100 : 0}%` }}></div>
            </div>
            <div className="flex justify-between text-xs mt-2 text-muted-foreground">
              <span>Lucro Bruto</span><span>Custo MP</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
