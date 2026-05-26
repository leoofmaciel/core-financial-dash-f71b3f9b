import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/partners")({ component: PartnersPage });

type Partner = { id: string; name: string; share_percent: number; position: number };

function PartnersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState({ name: "", share_percent: 50 });

  const { data = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("*").order("position");
      if (error) throw error;
      return data as Partner[];
    },
  });

  const totalShare = data.reduce((s, p) => s + Number(p.share_percent || 0), 0);

  const openNew = () => { setEditing(null); setForm({ name: "", share_percent: 50 }); setOpen(true); };
  const openEdit = (p: Partner) => { setEditing(p); setForm({ name: p.name, share_percent: Number(p.share_percent) }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (editing) {
      const { error } = await supabase.from("partners").update({ name: form.name, share_percent: form.share_percent }).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("partners").insert({ name: form.name, share_percent: form.share_percent, position: data.length, user_id: user.id });
      if (error) return toast.error(error.message);
    }
    toast.success("Sócio salvo");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["partners"] });
  };

  const remove = async (p: Partner) => {
    const { error } = await supabase.from("partners").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["partners"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Sócios</h1>
          <p className="text-sm text-muted-foreground">Cadastre os sócios para usar no rateio de investimentos e contas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo sócio</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar sócio" : "Novo sócio"}</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} /></div>
              <div className="space-y-2"><Label>Participação (%)</Label><Input type="number" min={0} max={100} step={0.01} value={form.share_percent} onChange={(e) => setForm({ ...form, share_percent: Number(e.target.value) })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nome</TableHead><TableHead className="text-right">Participação</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && data.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum sócio cadastrado.</TableCell></TableRow>}
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">{Number(p.share_percent).toFixed(1)}%</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Excluir sócio?</AlertDialogTitle></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(p)}>Excluir</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.length > 0 && (
            <p className={`text-sm mt-3 ${Math.abs(totalShare - 100) < 0.01 ? "text-muted-foreground" : "text-destructive"}`}>
              Total: {totalShare.toFixed(1)}% {Math.abs(totalShare - 100) >= 0.01 && "(deve somar 100%)"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
