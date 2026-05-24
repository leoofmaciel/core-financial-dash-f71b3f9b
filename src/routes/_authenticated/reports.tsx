import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportCSV } from "@/lib/csv";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

function ReportsPage() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const last = today.toISOString().slice(0, 10);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [type, setType] = useState("all");
  const [categoryId, setCategoryId] = useState("all");

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["report-txs", from, to, type, categoryId],
    queryFn: async () => {
      let q = supabase.from("transactions").select("*, categories(name)").gte("transaction_date", from).lte("transaction_date", to);
      if (type !== "all") q = q.eq("type", type as any);
      if (categoryId !== "all") q = q.eq("category_id", categoryId);
      const { data } = await q.order("transaction_date", { ascending: false });
      return data ?? [];
    },
  });

  const totalIn = txs.filter((t: any) => t.type === "entrada").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalOut = txs.filter((t: any) => t.type === "saida").reduce((s: number, t: any) => s + Number(t.amount), 0);

  const groupByCategory = (kind: "entrada" | "saida") => {
    const map = new Map<string, number>();
    txs.filter((t: any) => t.type === kind).forEach((t: any) => {
      const name = t.categories?.name ?? "Sem categoria";
      map.set(name, (map.get(name) ?? 0) + Number(t.amount));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const incomeByCat = groupByCategory("entrada");
  const expenseByCat = groupByCategory("saida");
  const pieColors = ["#1e40af", "#0891b2", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório Financeiro", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${formatDate(from)} até ${formatDate(to)}`, 14, 25);
    doc.text(`Entradas: ${formatBRL(totalIn)}   Saídas: ${formatBRL(totalOut)}   Saldo: ${formatBRL(totalIn - totalOut)}`, 14, 31);
    autoTable(doc, {
      startY: 38,
      head: [["Código", "Data", "Nome", "Categoria", "Tipo", "Valor"]],
      body: txs.map((t: any) => [t.code, formatDate(t.transaction_date), t.name, t.categories?.name ?? "—", t.type, formatBRL(t.amount)]),
      headStyles: { fillColor: [30, 41, 130] },
    });
    doc.save(`relatorio-${from}_${to}.pdf`);
  };

  const exportExcel = () => {
    exportCSV(`relatorio-${from}_${to}.csv`, [
      ["Código", "Data", "Nome", "Categoria", "Tipo", "Status", "Valor"],
      ...txs.map((t: any) => [
        t.code, formatDate(t.transaction_date), t.name, t.categories?.name ?? "—",
        t.type, t.status, Number(t.amount).toFixed(2).replace(".", ","),
      ]),
      [],
      ["Totais"],
      ["Entradas", "", "", "", "", "", totalIn.toFixed(2).replace(".", ",")],
      ["Saídas", "", "", "", "", "", totalOut.toFixed(2).replace(".", ",")],
      ["Saldo", "", "", "", "", "", (totalIn - totalOut).toFixed(2).replace(".", ",")],
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Filtre, totalize e exporte.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
          <Button onClick={exportPDF}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-4">
          <div className="space-y-2"><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Entradas</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-success">{formatBRL(totalIn)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Saídas</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">{formatBRL(totalOut)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Saldo</CardTitle></CardHeader><CardContent className={`text-2xl font-bold ${totalIn - totalOut >= 0 ? "text-primary" : "text-destructive"}`}>{formatBRL(totalIn - totalOut)}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Saídas por categoria</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {expenseByCat.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.name}>
                    {expenseByCat.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Entradas por categoria</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {incomeByCat.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeByCat}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="value" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Data</TableHead><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
            <TableBody>
              {txs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum resultado.</TableCell></TableRow>}
              {txs.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell>{formatDate(t.transaction_date)}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{t.categories?.name ?? "—"}</TableCell>
                  <TableCell><span className={t.type === "entrada" ? "text-success" : "text-destructive"}>{t.type}</span></TableCell>
                  <TableCell className="text-right font-semibold">{formatBRL(t.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
