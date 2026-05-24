import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, Wallet, Clock } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data: txs } = await supabase.from("transactions").select("*, categories(name,color)").order("transaction_date", { ascending: false });
      return txs ?? [];
    },
  });

  const now = new Date();
  const monthTxs = (data ?? []).filter((t) => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const entradas = monthTxs.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const saidas = monthTxs.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const saldo = entradas - saidas;
  const pendentes = (data ?? []).filter((t) => t.status === "pendente" || t.status === "atrasado").length;

  // Last 6 months chart
  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    const monthData = (data ?? []).filter((t) => {
      const td = new Date(t.transaction_date);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    });
    return {
      mes: label,
      Entradas: monthData.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0),
      Saídas: monthData.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0),
    };
  });

  const recent = (data ?? []).slice(0, 8);

  const cards = [
    { title: "Entradas do mês", value: entradas, icon: ArrowUpCircle, color: "text-success", bg: "bg-success/10" },
    { title: "Saídas do mês", value: saidas, icon: ArrowDownCircle, color: "text-destructive", bg: "bg-destructive/10" },
    { title: "Saldo atual", value: saldo, icon: Wallet, color: saldo >= 0 ? "text-primary" : "text-destructive", bg: "bg-primary/10" },
    { title: "Contas pendentes", value: pendentes, icon: Clock, color: "text-warning", bg: "bg-warning/10", isCount: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral das suas finanças.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.title}</p>
                  <p className={`mt-2 text-2xl font-bold ${c.color}`}>
                    {isLoading ? "—" : c.isCount ? c.value : formatBRL(c.value)}
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Entradas e Saídas — últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="Entradas" fill="oklch(0.62 0.16 155)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Saídas" fill="oklch(0.58 0.22 27)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Últimas movimentações</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>}
            {recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.transaction_date)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                    {t.type === "entrada" ? "+" : "-"} {formatBRL(t.amount)}
                  </p>
                  <Badge variant="outline" className="text-[10px] mt-0.5">{t.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
