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
import { FileDown } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Filtre, totalize e exporte em PDF.</p>
        </div>
        <Button onClick={exportPDF}><FileDown className="h-4 w-4 mr-1" /> Exportar PDF</Button>
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
