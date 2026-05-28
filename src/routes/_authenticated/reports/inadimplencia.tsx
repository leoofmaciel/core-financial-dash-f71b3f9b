import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { formatBRL, formatDate } from "@/lib/format";
import { ArrowLeft, Download, AlertTriangle, Clock } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports/inadimplencia")({
  component: InadimplenciaReport,
});

function InadimplenciaReport() {
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const company = useCompanySettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions_inadimplencia", endDate],
    queryFn: async () => {
      // Pega contas a receber pendentes ou atrasadas com vencimento até a data selecionada
      const { data } = await supabase
        .from("transactions")
        .select("*, categories(name)")
        .eq("type", "entrada")
        .in("status", ["pendente", "atrasado"])
        .lte("due_date", endDate)
        .order("due_date", { ascending: true });
      return data || [];
    },
  });

  const totalAtrasado = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
  
  const todayStr = new Date().toISOString().split("T")[0];
  
  const agrupadoPorCliente = transactions.reduce((acc, t) => {
    // Tentativa de agrupar pelo nome do cliente se estiver na descrição ou nome
    // Para um sistema mais robusto, a transaction deveria ter um client_id
    const nome = t.name || "Cliente Desconhecido";
    if (!acc[nome]) acc[nome] = { total: 0, items: [] };
    acc[nome].total += Number(t.amount);
    acc[nome].items.push(t);
    return acc;
  }, {} as Record<string, { total: number, items: any[] }>);

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
      pdf.text(`Posição até: ${formatDate(endDate)}`, margin, 22);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(18);
      pdf.text("RADAR DE INADIMPLÊNCIA", pageW - margin, 20, { align: "right" });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfInnerW = pageW - margin * 2;
      const pdfInnerH = (imgProps.height * pdfInnerW) / imgProps.width;
      pdf.addImage(imgData, "PNG", margin, headerH + 10, pdfInnerW, pdfInnerH);
      pdf.save(`Radar_Inadimplencia.pdf`);
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
          <h1 className="text-2xl font-bold flex items-center gap-2">Radar de Inadimplência</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs">Posição de Atrasos Até</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <Button onClick={exportPDF} className="h-9"><Download className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </div>
      
      <div ref={reportRef} className="space-y-6 bg-white p-6 rounded-xl border">
        
        <div className="flex flex-col items-center justify-center p-6 bg-orange-50 rounded-xl border border-orange-200">
          <AlertTriangle className="h-10 w-10 text-orange-500 mb-2" />
          <h2 className="text-sm font-medium text-orange-800 uppercase tracking-widest mb-2">Total Recebimentos Atrasados</h2>
          <div className="text-5xl font-black text-orange-600">{formatBRL(totalAtrasado)}</div>
          <p className="text-sm text-orange-700/80 mt-2">Valores que já passaram da data de vencimento e não foram pagos.</p>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Nenhum recebimento atrasado até esta data. Ótimo trabalho!</div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Detalhamento por Título</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {transactions.map(t => {
                const vencimentoStr = formatDate(t.due_date || t.transaction_date);
                const isVeryLate = t.due_date && t.due_date < todayStr;
                return (
                  <Card key={t.id} className={`border ${isVeryLate ? 'border-red-200 bg-red-50/10' : 'border-orange-100'}`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-slate-800 line-clamp-1" title={t.name}>{t.name}</span>
                        <span className="font-bold text-red-600">{formatBRL(t.amount)}</span>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Vencimento: {vencimentoStr}</span>
                      </div>
                      {t.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{t.description}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
