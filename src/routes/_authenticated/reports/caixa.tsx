import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports/caixa")({
  component: CaixaPage,
});

function CaixaPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-caixa"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: txs, error } = await supabase
        .from("transactions")
        .select("type, amount, status, transaction_date, due_date, payment_method")
        .lte("transaction_date", today);
      if (error) throw error;
      return txs ?? [];
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  const txs = data ?? [];
  const paidIn = txs.filter((t: any) => t.type === "entrada" && t.status === "pago");
  const paidOut = txs.filter((t: any) => t.type === "saida" && t.status === "pago");
  const pendingIn = txs.filter((t: any) => t.type === "entrada" && t.status !== "pago");
  const pendingOut = txs.filter((t: any) => t.type === "saida" && t.status !== "pago");

  const totalIn = paidIn.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalOut = paidOut.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const saldo = totalIn - totalOut;

  const totalPendIn = pendingIn.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalPendOut = pendingOut.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const projetado = saldo + totalPendIn - totalPendOut;

  // Por método de pagamento (apenas pagos)
  const byMethod: Record<string, { in: number; out: number }> = {};
  for (const t of [...paidIn, ...paidOut]) {
    const m = (t as any).payment_method || "Não informado";
    if (!byMethod[m]) byMethod[m] = { in: 0, out: 0 };
    if ((t as any).type === "entrada") byMethod[m].in += Number((t as any).amount);
    else byMethod[m].out += Number((t as any).amount);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-600" /> Saldo em Caixa
          </h1>
          <p className="text-sm text-muted-foreground">Quanto você tem em caixa hoje, considerando todas as movimentações pagas.</p>
        </div>
      </div>

      <Card className="border-2 border-emerald-500 bg-emerald-50">
        <CardHeader>
          <CardDescription className="text-emerald-900">Saldo Atual (Caixa Realizado)</CardDescription>
          <CardTitle className={`text-4xl ${saldo >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatBRL(saldo)}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-emerald-900">
          Entradas pagas <strong>{formatBRL(totalIn)}</strong> − Saídas pagas <strong>{formatBRL(totalOut)}</strong>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-600" /> Recebido</CardDescription><CardTitle className="text-xl text-green-700">{formatBRL(totalIn)}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{paidIn.length} lançamento(s)</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-600" /> Pago</CardDescription><CardTitle className="text-xl text-red-700">{formatBRL(totalOut)}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{paidOut.length} lançamento(s)</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Clock className="h-3 w-3 text-blue-600" /> A receber</CardDescription><CardTitle className="text-xl text-blue-700">{formatBRL(totalPendIn)}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{pendingIn.length} pendente(s)</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Clock className="h-3 w-3 text-orange-600" /> A pagar</CardDescription><CardTitle className="text-xl text-orange-700">{formatBRL(totalPendOut)}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{pendingOut.length} pendente(s)</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saldo Projetado</CardTitle>
          <CardDescription>Saldo atual + contas a receber − contas a pagar pendentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${projetado >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatBRL(projetado)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por Forma de Pagamento</CardTitle>
          <CardDescription>Apenas movimentações já pagas / recebidas</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(byMethod).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação paga.</p>
          ) : (
            <div className="divide-y">
              {Object.entries(byMethod).map(([method, v]) => (
                <div key={method} className="py-2 grid grid-cols-3 gap-2 text-sm">
                  <span className="font-medium">{method}</span>
                  <span className="text-right text-green-700">+{formatBRL(v.in)}</span>
                  <span className="text-right text-red-700">−{formatBRL(v.out)}</span>
                </div>
              ))}
              <div className="py-2 grid grid-cols-3 gap-2 text-sm font-semibold border-t-2">
                <span>Total</span>
                <span className="text-right text-green-700">+{formatBRL(totalIn)}</span>
                <span className="text-right text-red-700">−{formatBRL(totalOut)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
