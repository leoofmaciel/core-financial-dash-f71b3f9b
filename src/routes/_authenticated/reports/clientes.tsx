import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { formatBRL, formatDate } from "@/lib/format";
import { ArrowLeft, Download, Award, Trophy, Medal } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports/clientes")({
  component: RankingClientesReport,
});

function RankingClientesReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().split("T")[0];
  });

  const company = useCompanySettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders_clients", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("total, clients(name, company)")
        .in("status", ["aprovado", "faturado"])
        .gte("created_at", `${startDate}T00:00:00Z`)
        .lte("created_at", `${endDate}T23:59:59Z`);
      return data || [];
    },
  });

  const clientTotals = orders.reduce((acc, order) => {
    const clientName = order.clients?.company || order.clients?.name || "Cliente Desconhecido";
    acc[clientName] = (acc[clientName] || 0) + (order.total || 0);
    return acc;
  }, {} as Record<string, number>);

  const sortedClients = Object.entries(clientTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

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
      pdf.text("RANKING DE CLIENTES", pageW - margin, 20, { align: "right" });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfInnerW = pageW - margin * 2;
      const pdfInnerH = (imgProps.height * pdfInnerW) / imgProps.width;
      pdf.addImage(imgData, "PNG", margin, headerH + 10, pdfInnerW, pdfInnerH);
      pdf.save(`Ranking_Clientes.pdf`);
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
          <h1 className="text-2xl font-bold flex items-center gap-2">Ranking de Clientes</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><label className="text-xs">Data Inicial</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-[130px]" /></div>
          <div className="space-y-1"><label className="text-xs">Data Final</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[130px]" /></div>
          <Button onClick={exportPDF} className="h-9"><Download className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </div>
      
      <div ref={reportRef} className="space-y-6 bg-white p-6 rounded-xl border">
        <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
          <Award className="h-10 w-10 text-indigo-500 mb-2" />
          <h2 className="text-xl font-bold text-slate-800 text-center">Top 10 Melhores Clientes</h2>
          <p className="text-sm text-slate-500 text-center mt-1">Baseado no valor total de orçamentos aprovados/faturados no período selecionado.</p>
        </div>

        {sortedClients.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Nenhum pedido aprovado neste período.</div>
        ) : (
          <div className="space-y-3">
            {sortedClients.map(([clientName, total], index) => {
              let icon = <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">{index + 1}</div>;
              if (index === 0) icon = <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center"><Trophy className="h-5 w-5 text-yellow-600" /></div>;
              if (index === 1) icon = <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center"><Medal className="h-5 w-5 text-slate-500" /></div>;
              if (index === 2) icon = <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center"><Medal className="h-4 w-4 text-amber-700" /></div>;

              return (
                <div key={clientName} className={`flex items-center justify-between p-4 rounded-lg border ${index === 0 ? 'bg-yellow-50/30 border-yellow-200' : 'bg-white'}`}>
                  <div className="flex items-center gap-4">
                    {icon}
                    <span className={`font-semibold ${index === 0 ? 'text-lg text-slate-900' : 'text-slate-700'}`}>{clientName}</span>
                  </div>
                  <span className={`font-bold ${index === 0 ? 'text-xl text-indigo-700' : 'text-slate-700'}`}>
                    {formatBRL(total)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
