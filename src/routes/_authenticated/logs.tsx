import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { Pagination, paginate } from "@/components/pagination";

export const Route = createFileRoute("/_authenticated/logs")({ component: LogsPage });

function LogsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const actionVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    create: "default",
    update: "secondary",
    delete: "destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Histórico de alterações</h1>
        <p className="text-sm text-muted-foreground">Últimas 500 ações registradas no sistema.</p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && logs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum registro.</TableCell></TableRow>}
              {paginate(logs, page, pageSize).map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(l.created_at)} {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell><Badge variant={actionVariant[l.action] ?? "outline"}>{l.action}</Badge></TableCell>
                  <TableCell className="font-medium">{l.entity}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                    {l.details ? JSON.stringify(l.details) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={logs.length} onChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
