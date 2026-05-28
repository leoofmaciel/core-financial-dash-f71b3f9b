import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2 } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { logActivity } from "@/lib/logs";
import { OrderHubDialog } from "@/components/order-hub-dialog";

export const Route = createFileRoute("/_authenticated/orders/")({ component: OrdersList });

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  orcamento: { label: "Orçamento", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

function OrdersList() {
  const qc = useQueryClient();
  const [hubOpen, setHubOpen] = useState(false);
  const [hubId, setHubId] = useState<string | null>(null);

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
    // delete linked records first (no cascade configured yet)
    await supabase.from("budget_items").delete().in("budget_id", (await supabase.from("budgets").select("id").eq("order_id", o.id)).data?.map((b: any) => b.id) ?? []);
    await supabase.from("budgets").delete().eq("order_id", o.id);
    await supabase.from("order_items").delete().eq("order_id", o.id);
    await supabase.from("order_materials").delete().eq("order_id", o.id);
    await supabase.from("transactions").delete().eq("order_id", o.id);
    const { error } = await supabase.from("orders").delete().eq("id", o.id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "order", o.id, { number: o.number });
    toast.success("Pedido e dados vinculados excluídos");
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const openHub = (id: string) => { setHubId(id); setHubOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Toque em um pedido para abrir o hub operacional.</p>
        </div>
        <Button onClick={() => openHub("new")}>
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
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openHub(o.id)}>
                    <TableCell className="font-mono">#{String(o.number).padStart(5, "0")}</TableCell>
                    <TableCell className="font-medium">{o.client?.name ?? "—"}{o.client?.company ? ` • ${o.client.company}` : ""}</TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    <TableCell>{formatDate(o.created_at)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(o.total)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir pedido #{String(o.number).padStart(5, "0")}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Serão removidos permanentemente:
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                  <li>Itens do pedido</li>
                                  <li>Materiais e contas a pagar vinculadas</li>
                                  <li>Orçamentos e PDFs gerados</li>
                                  <li>Contas a receber vinculadas</li>
                                </ul>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(o)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir tudo</AlertDialogAction></AlertDialogFooter>
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

      <OrderHubDialog orderId={hubId} open={hubOpen} onOpenChange={setHubOpen} />
    </div>
  );
}
