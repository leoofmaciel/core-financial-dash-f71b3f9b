import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, TrendingUp, TrendingDown, Users, AlertCircle, DollarSign, BarChart2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsMenuPage,
});

const reportsList = [
  {
    title: "Saldo em Caixa",
    description: "Quanto você tem em caixa agora — entradas pagas menos saídas pagas.",
    icon: DollarSign,
    color: "text-emerald-700",
    bg: "bg-emerald-100",
    url: "/reports/caixa",
  },
  {
    title: "Faturamento vs Custos",
    description: "Análise do faturamento contra os custos de matéria-prima.",
    icon: TrendingUp,
    color: "text-green-600",
    bg: "bg-green-100",
    url: "/reports/faturamento",
  },
  {
    title: "Taxa de Conversão",
    description: "Desempenho comercial e aprovação de orçamentos.",
    icon: BarChart2,
    color: "text-blue-600",
    bg: "bg-blue-100",
    url: "/reports/conversao",
  },
  {
    title: "Previsão Fluxo de Caixa",
    description: "Contas a pagar vs Contas a receber para os próximos dias.",
    icon: DollarSign,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    url: "/reports/fluxo",
  },
  {
    title: "Ranking de Clientes",
    description: "Identifique os melhores clientes por volume de faturamento.",
    icon: Users,
    color: "text-indigo-600",
    bg: "bg-indigo-100",
    url: "/reports/clientes",
  },
  {
    title: "Custos Fixos e Energia",
    description: "Acompanhe os gastos operacionais como energia elétrica.",
    icon: TrendingDown,
    color: "text-purple-600",
    bg: "bg-purple-100",
    url: "/reports/fixos",
  },
  {
    title: "Radar de Inadimplência",
    description: "Clientes com pagamentos atrasados (Aging).",
    icon: AlertCircle,
    color: "text-orange-600",
    bg: "bg-orange-100",
    url: "/reports/inadimplencia",
  },
];

function ReportsMenuPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PieChart className="h-6 w-6 text-blue-600" />
          Central de Relatórios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o relatório que deseja visualizar para acessar os dados detalhados e exportar em PDF.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportsList.map((report) => (
          <Link key={report.url} to={report.url} className="block transition-transform hover:-translate-y-1">
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${report.bg} ${report.color}`}>
                    <report.icon className="h-5 w-5" />
                  </div>
                  {report.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{report.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
