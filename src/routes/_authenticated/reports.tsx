import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { formatBRL, formatDate } from "@/lib/format";
import { PieChart, Download, DollarSign, TrendingUp, TrendingDown, Users, AlertCircle } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().split("T")[0];
  });

  const company = useCompanySettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*, categories(name)")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .order("transaction_date", { ascending: true });
      return data || [];
    },
  });

  const { data: allTransactions = [] } = useQuery({
    queryKey: ["all_transactions_for_aging"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("status", "pendente")
        .eq("type", "entrada")
        .not("due_date", "is", null);
      return data || [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders_reports", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, clients(name)")
        .gte("created_at", `${startDate}T00:00:00Z`)
        .lte("created_at", `${endDate}T23:59:59Z`);
      return data || [];
    },
  });

  // --- Calculations ---

  // 1. Faturamento vs Custo MP
  const rawMaterialCategories = ["aço", "alumínio", "aluminio", "solda", "matéria", "materia", "insumos"];
  let faturamento = 0;
  let custoMP = 0;
  let totalFixos = 0; // Para relatório de energia/fixos
  let energia = 0;

  transactions.forEach((t) => {
    if (t.status === "pago") {
      if (t.type === "entrada") faturamento += t.amount;
      if (t.type === "saida") {
        const catName = t.categories?.name?.toLowerCase() || "";
        const isMP = rawMaterialCategories.some(k => catName.includes(k));
        if (isMP) {
          custoMP += t.amount;
        } else {
          totalFixos += t.amount;
          if (catName.includes("energia") || catName.includes("luz") || catName.includes("cpfl") || catName.includes("enel")) {
            energia += t.amount;
          }
        }
      }
    }
  });

  // 2. Orçamentos (Taxa de conversão)
  const totalOrcamentos = orders.length;
  const aprovados = orders.filter(o => o.status === "aprovado" || o.status === "faturado").length;
  const taxaConversao = totalOrcamentos > 0 ? Math.round((aprovados / totalOrcamentos) * 100) : 0;

  // 3. Previsão Fluxo de Caixa (Pendentes no período)
  let aReceber = 0;
  let aPagar = 0;
  transactions.forEach(t => {
    if (t.status === "pendente") {
      if (t.type === "entrada") aReceber += t.amount;
      else aPagar += t.amount;
    }
  });

  // 4. Ranking de Clientes (Top 5)
  const clientesMap: Record<string, number> = {};
  orders.forEach(o => {
    if (o.status === "aprovado" || o.status === "faturado") {
      const nome = o.clients?.name || "Desconhecido";
      clientesMap[nome] = (clientesMap[nome] || 0) + o.total;
    }
  });
  const topClientes = Object.entries(clientesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 6. Inadimplência (Aging)
  let atraso1a15 = 0;
  let atraso16a30 = 0;
  let atrasoMais30 = 0;
  const hoje = new Date();
  
  allTransactions.forEach(t => {
    if (t.due_date) {
      const due = new Date(t.due_date);
      if (due < hoje) {
        const diffTime = Math.abs(hoje.getTime() - due.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 15) atraso1a15 += t.amount;
        else if (diffDays <= 30) atraso16a30 += t.amount;
        else atrasoMais30 += t.amount;
      }
    }
  });
  const totalInadimplencia = atraso1a15 + atraso16a30 + atrasoMais30;


  const exportPDF = async () => {
    if (!reportRef.current) return;
    const toastId = toast.loading("Gerando PDF do Relatório...");
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 14;

      // Header Colors
      const NAVY: [number, number, number] = [15, 23, 42];
      const BLUE: [number, number, number] = [29, 78, 216];
      const headerH = 35;
      
      pdf.setFillColor(...NAVY);
      pdf.rect(0, 0, pageW, headerH, "F");
      pdf.setFillColor(...BLUE);
      pdf.triangle(pageW * 0.4, 0, pageW, 0, pageW, headerH, "F");

      // Logo
      let logoOffset = 0;
      if (company?.logo_url) {
        try {
          const url = new URL(company.logo_url);
          url.searchParams.set("t", Date.now().toString());
          const logoData = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const cvs = document.createElement("canvas");
              cvs.width = img.width; cvs.height = img.height;
              const ctx = cvs.getContext("2d");
              if (ctx) { ctx.drawImage(img, 0, 0); resolve(cvs.toDataURL("image/png")); }
              else reject();
            };
            img.onerror = reject;
            img.src = url.toString();
          });
          pdf.addImage(logoData, "PNG", margin, 6, 22, 22);
          logoOffset = 26;
        } catch (e) {}
      }

      pdf.setTextColor(255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(company?.company_name || "Relatórios", margin + logoOffset, 16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`, margin + logoOffset, 22);

      // Title Right
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("RELATÓRIO GERENCIAL", pageW - margin, 20, { align: "right" });

      // Add screenshot
      const imgProps = pdf.getImageProperties(imgData);
      const pdfInnerW = pageW - margin * 2;
      const pdfInnerH = (imgProps.height * pdfInnerW) / imgProps.width;
      
      let yPos = headerH + 10;
      pdf.addImage(imgData, "PNG", margin, yPos, pdfInnerW, pdfInnerH);

      pdf.save(`Relatorio_${startDate}_${endDate}.pdf`);
      toast.success("PDF baixado com sucesso!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF", { id: toastId });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PieChart className="h-6 w-6 text-blue-600" />
            Central de Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">Visão estratégica para metalúrgicas.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Inicial</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-[140px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Final</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[140px]" />
          </div>
          <Button onClick={exportPDF} className="h-9" variant="default">
            <Download className="h-4 w-4 mr-2" />
            Baixar PDF
          </Button>
        </div>
      </div>

      {/* Report Content - Wrapped in a ref for PDF capture */}
      <div ref={reportRef} className="space-y-6 bg-slate-50/50 p-4 rounded-xl">
        
        {/* KPI Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Faturamento (Pagas)</p>
                  <h3 className="text-2xl font-bold text-green-700">{formatBRL(faturamento)}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center shrink-0">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Custo Matéria-Prima</p>
                  <h3 className="text-2xl font-bold text-red-700">{formatBRL(custoMP)}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Representa {faturamento > 0 ? Math.round((custoMP / faturamento) * 100) : 0}% do faturamento.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Custo de Energia</p>
                  <h3 className="text-2xl font-bold text-slate-700">{formatBRL(energia)}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Outros fixos: {formatBRL(totalFixos - energia)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Radar de Inadimplência (Aging)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-2">
                <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                  <span className="font-medium text-slate-700">1 a 15 dias de atraso</span>
                  <span className="font-bold text-orange-600">{formatBRL(atraso1a15)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                  <span className="font-medium text-slate-700">16 a 30 dias de atraso</span>
                  <span className="font-bold text-red-500">{formatBRL(atraso16a30)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                  <span className="font-medium text-slate-700">Mais de 30 dias de atraso</span>
                  <span className="font-bold text-red-700">{formatBRL(atrasoMais30)}</span>
                </div>
                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total em Atraso (Geral):</span>
                  <span className="text-lg font-bold text-destructive">{formatBRL(totalInadimplencia)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Ranking de Melhores Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topClientes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum orçamento faturado no período.</p>
              ) : (
                <div className="space-y-3 mt-2">
                  {topClientes.map(([nome, valor], i) => (
                    <div key={nome} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-md">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="font-medium text-sm truncate max-w-[150px]">{nome}</span>
                      </div>
                      <span className="font-bold text-sm">{formatBRL(valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Previsão Fluxo de Caixa</CardTitle>
              <p className="text-sm text-muted-foreground">Contas Pendentes (A Pagar vs A Receber) no período</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 mt-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-green-700">A Receber</span>
                    <span className="font-bold">{formatBRL(aReceber)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: aReceber > 0 ? '100%' : '0%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-red-700">A Pagar</span>
                    <span className="font-bold">{formatBRL(aPagar)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full" style={{ width: aPagar > 0 ? '100%' : '0%' }}></div>
                  </div>
                </div>
                <div className="pt-3 border-t mt-4 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Saldo Previsto:</span>
                  <span className={`text-lg font-bold ${aReceber - aPagar >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatBRL(aReceber - aPagar)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Taxa de Conversão</CardTitle>
              <p className="text-sm text-muted-foreground">Orçamentos gerados vs aprovados no período</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-slate-800">{totalOrcamentos}</p>
                  <p className="text-xs text-muted-foreground mt-1">Gerados</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-black text-blue-600">{taxaConversao}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Taxa de Aprovação</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{aprovados}</p>
                  <p className="text-xs text-muted-foreground mt-1">Aprovados</p>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden mt-8">
                <div className="bg-blue-600 h-full transition-all" style={{ width: `${taxaConversao}%` }}></div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
