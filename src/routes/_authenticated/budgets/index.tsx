import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, FileDown, Trash2, Pencil } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { generateBudgetPDF } from "@/lib/pdf";
import { toast } from "sonner";
import { logActivity } from "@/lib/logs";
import { Pagination, paginate } from "@/components/pagination";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/budgets/")({ component: BudgetsList });

function BudgetsList() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const downloadPdf = async (id: string) => {
    const [{ data: b }, { data: items }, { data: { user } }] = await Promise.all([
      supabase.from("budgets").select("*").eq("id", id).single(),
      supabase.from("budget_items").select("*").eq("budget_id", id).order("position"),
      supabase.auth.getUser(),
    ]);
    if (!b) return;
    const { data: company } = await supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle();
    await generateBudgetPDF({ ...b, items: items ?? [] } as any, company ?? {});
  };

  const remove = async (b: any) => {
    const { error } = await supabase.from("budgets").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "budget", b.id, { client: b.client_name, number: b.number });
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const pageItems = paginate(budgets, page, pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Crie e baixe orçamentos em PDF.</p>
        </div>
        <Button asChild><Link to="/budgets/new"><Plus className="h-4 w-4 mr-1" /> Novo orçamento</Link></Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && budgets.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum orçamento ainda.</TableCell></TableRow>}
              {pageItems.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono">#{String(b.number).padStart(5, "0")}</TableCell>
                  <TableCell className="font-medium">{b.client_name}</TableCell>
                  <TableCell>{formatDate(b.created_at)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatBRL(b.total)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => downloadPdf(b.id)}><FileDown className="h-4 w-4" /></Button>
                      <Button asChild size="icon" variant="ghost"><Link to="/budgets/$id" params={{ id: b.id }}><Pencil className="h-4 w-4" /></Link></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Excluir orçamento?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(b.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={budgets.length} onChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
