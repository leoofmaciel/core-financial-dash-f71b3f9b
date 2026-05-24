import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, Wallet, Clock, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

const pieColors = ["#1e40af", "#0891b2", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data: txs } = await supabase.from("transactions").select("*, categories(name,color)").order("transaction_date", { ascending: false });
      return txs ?? [];
    },
  });

  const now = new Date();
  const inMonth = (t: any, ref: Date) => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
  };
  const prevMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const monthTxs = (data ?? []).filter((t) => inMonth(t, now));
  const prevMonthTxs = (data ?? []).filter((t) => inMonth(t, prevMonthRef));

  const sum = (arr: any[], kind: string) =>
    arr.filter((t) => t.type === kind).reduce((s, t) => s + Number(t.amount), 0);

  const entradas = sum(monthTxs, "entrada");
  const saidas = sum(monthTxs, "saida");
  const saldo = entradas - saidas;
  const prevEntradas = sum(prevMonthTxs, "entrada");
  const prevSaidas = sum(prevMonthTxs, "saida");
  const prevSaldo = prevEntradas - prevSaidas;

  const pct = (cur: number, prev: number) => {
    if (!prev) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(); in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);
  const overdue = (data ?? []).filter((t) =>
    (t.status === "pendente" || t.status === "atrasado") && t.due_date && t.due_date < today
  );
  const upcoming = (data ?? []).filter((t) =>
    (t.status === "pendente" || t.status === "atrasado") && t.due_date && t.due_date >= today && t.due_date <= in7Str
  );
  const pendentes = overdue.length + upcoming.length;

  // Last 6 months chart
  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    const monthData = (data ?? []).filter((t) => inMonth(t, d));
    const ent = sum(monthData, "entrada");
    const sai = sum(monthData, "saida");
    return { mes: label, Entradas: ent, Saídas: sai, Saldo: ent - sai };
  });

  // Top categorias (saídas do mês)
  const topCategoriesMap = new Map<string, number>();
  monthTxs.filter((t) => t.type === "saida").forEach((t) => {
    const name = t.categories?.name ?? "Sem categoria";
    topCategoriesMap.set(name, (topCategoriesMap.get(name) ?? 0) + Number(t.amount));
  });
  const topCategories = Array.from(topCategoriesMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const recent = (data ?? []).slice(0, 6);

  const TrendBadge = ({ value }: { value: number | null }) => {
    if (value === null) return null;
    const positive = value >= 0;
    const Icon = positive ? TrendingUp : TrendingDown;
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${positive ? "text-success" : "text-destructive"}`}>
        <Icon className="h-3 w-3" />
        {positive ? "+" : ""}{value.toFixed(1)}% vs mês ant.
      </span>
    );
  };

  const cards = [
    { title: "Entradas do mês", value: entradas, icon: ArrowUpCircle, color: "text-success", bg: "bg-success/10", trend: pct(entradas, prevEntradas) },
    { title: "Saídas do mês", value: saidas, icon: ArrowDownCircle, color: "text-destructive", bg: "bg-destructive/10", trend: pct(saidas, prevSaidas) },
    { title: "Saldo atual", value: saldo, icon: Wallet, color: saldo >= 0 ? "text-primary" : "text-destructive", bg: "bg-primary/10", trend: pct(saldo, prevSaldo) },
    { title: "Contas pendentes", value: pendentes, icon: Clock, color: "text-warning", bg: "bg-warning/10", isCount: true, trend: null },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral das suas finanças.</p>
      </div>

      {overdue.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-destructive">
                {overdue.length} conta(s) vencida(s)
              </p>
              <p className="text-sm text-muted-foreground">
                Total: {formatBRL(overdue.reduce((s, t) => s + Number(t.amount), 0))}
              </p>
            </div>
            <Link to="/transactions" className="text-sm font-medium text-primary hover:underline">
              Ver todas →
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.title}</p>
                  <p className={`mt-2 text-2xl font-bold ${c.color}`}>
                    {isLoading ? "—" : c.isCount ? c.value : formatBRL(c.value)}
                  </p>
                  <div className="mt-1"><TrendBadge value={c.trend} /></div>
                </div>
                <div className={`h-10 w-10 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
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
            <CardTitle>Fluxo de caixa — últimos 6 meses</CardTitle>
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
          <CardHeader><CardTitle>Top categorias (saídas do mês)</CardTitle></CardHeader>
          <CardContent>
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem saídas este mês.</p>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={topCategories} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                        {topCategories.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {topCategories.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: pieColors[i % pieColors.length] }} />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="font-medium tabular-nums">{formatBRL(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Próximos vencimentos (7 dias)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vencimento próximo.</p>}
            {upcoming.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">Vence {formatDate(t.due_date)}</p>
                </div>
                <p className={`text-sm font-semibold ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                  {formatBRL(t.amount)}
                </p>
              </div>
            ))}
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
