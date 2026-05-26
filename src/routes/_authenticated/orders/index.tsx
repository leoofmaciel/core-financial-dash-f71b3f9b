import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { logActivity } from "@/lib/logs";

export const Route = createFileRoute("/_authenticated/orders/")({ component: OrdersList });

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  orcamento: { label: "Orçamento", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

function OrdersList() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, client:clients(name, company)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const remove = async (o: any) => {
    const { error } = await supabase.from("orders").delete().eq("id", o.id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "order", o.id, { number: o.number });
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Crie pedidos, gere orçamentos, aprove e controle materiais.</p>
        </div>
        <Button onClick={() => navigate({ to: "/orders/$id", params: { id: "new" } })}>
          <Plus className="h-4 w-4 mr-1" /> Novo pedido
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum pedido ainda.</TableCell></TableRow>}
              {data.map((o) => {
                const s = statusLabels[o.status] ?? { label: o.status, variant: "outline" as const };
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">#{String(o.number).padStart(5, "0")}</TableCell>
                    <TableCell className="font-medium">{o.client?.name ?? "—"}{o.client?.company ? ` • ${o.client.company}` : ""}</TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    <TableCell>{formatDate(o.created_at)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(o.total)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button asChild size="icon" variant="ghost"><Link to="/orders/$id" params={{ id: o.id }}><Pencil className="h-4 w-4" /></Link></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir pedido?</AlertDialogTitle><AlertDialogDescription>Os itens e materiais também serão excluídos.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(o)}>Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
