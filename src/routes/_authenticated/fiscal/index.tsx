import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useFiscal } from "@/modules/fiscal/hooks/useFiscal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/format";
import { Receipt, Search, Plus, FileText, Download, XCircle, AlertCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fiscal/")({
  component: FiscalDashboard,
});

function FiscalDashboard() {
  const { listarNotas } = useFiscal();
  const [search, setSearch] = useState("");

  const notas = listarNotas.data || [];
  
  // Dummy stats for the UI
  const totalEmitidoMes = notas.filter(n => n.status === "emitida").reduce((acc, n) => acc + n.total_amount, 0);
  const notasPendentes = notas.filter(n => n.status === "processando").length;
  const notasRejeitadas = notas.filter(n => n.status === "rejeitada").length;

  const filteredNotas = notas.filter(n => 
    (n.number?.includes(search)) || 
    (n.clients?.name?.toLowerCase().includes(search.toLowerCase())) ||
    (n.clients?.company?.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "emitida": return <Badge className="bg-green-500">Emitida</Badge>;
      case "processando": return <Badge variant="secondary" className="text-orange-600 bg-orange-100"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Processando</Badge>;
      case "cancelada": return <Badge variant="destructive">Cancelada</Badge>;
      case "rejeitada": return <Badge variant="destructive" className="bg-red-700">Rejeitada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Receipt className="h-8 w-8 text-blue-600" />
            Módulo Fiscal
          </h1>
          <p className="text-sm text-muted-foreground">Emissão e gestão de NFe e NFS-e integrado com Notaas.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/fiscal/nova">
            <Button><Plus className="h-4 w-4 mr-1" /> Emitir Nova Nota</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Emitido (Mês)</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(totalEmitidoMes || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Notas Emitidas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notas.filter(n => n.status === "emitida").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">Processando</CardTitle>
            <RefreshCw className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{notasPendentes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Rejeitadas/Erros</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{notasRejeitadas}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Histórico de Notas</CardTitle>
            <div className="relative w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9 h-9" placeholder="Buscar por número ou cliente..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listarNotas.isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando dados fiscais...</TableCell></TableRow>
                )}
                {!listarNotas.isLoading && filteredNotas.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma nota encontrada no período.</TableCell></TableRow>
                )}
                {filteredNotas.map((nota) => (
                  <TableRow key={nota.id}>
                    <TableCell className="font-mono">{nota.number || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase font-bold text-xs">{nota.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {nota.clients?.company || nota.clients?.name || "—"}
                    </TableCell>
                    <TableCell>{formatDate(nota.created_at)}</TableCell>
                    <TableCell>{formatBRL(nota.total_amount)}</TableCell>
                    <TableCell>{getStatusBadge(nota.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={!nota.pdf_url} title="Baixar DANFE">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={!nota.xml_url} title="Baixar XML">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </Button>
                        {nota.status === "emitida" && (
                          <Button size="sm" variant="ghost" title="Cancelar Nota">
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DollarSignIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
