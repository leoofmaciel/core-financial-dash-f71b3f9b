import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({ component: TasksPage });

type Task = { id: string; title: string; notes: string | null; done: boolean; position: number };

function TasksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: "", notes: "" });

  const { data = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("done").order("position");
      if (error) throw error;
      return data as Task[];
    },
  });

  const openNew = () => { setEditing(null); setForm({ title: "", notes: "" }); setOpen(true); };
  const openEdit = (t: Task) => { setEditing(t); setForm({ title: t.title, notes: t.notes ?? "" }); setOpen(true); };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Título obrigatório");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (editing) {
      const { error } = await supabase.from("tasks").update({ title: form.title, notes: form.notes }).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("tasks").insert({ title: form.title, notes: form.notes, position: data.length, user_id: user.id });
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const toggle = async (t: Task) => {
    await supabase.from("tasks").update({ done: !t.done }).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const remove = async (t: Task) => {
    await supabase.from("tasks").delete().eq("id", t.id);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Tarefas / Pendências</h1>
          <p className="text-sm text-muted-foreground">Checklist de coisas a fazer.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova tarefa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova tarefa"}</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} /></div>
              <div className="space-y-2"><Label>Observações</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          {isLoading && <p className="text-center py-8 text-muted-foreground">Carregando...</p>}
          {!isLoading && data.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhuma tarefa.</p>}
          {data.map((t) => (
            <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/40">
              <Checkbox checked={t.done} onCheckedChange={() => toggle(t)} className="mt-1" />
              <div className="flex-1">
                <p className={t.done ? "line-through text-muted-foreground" : "font-medium"}>{t.title}</p>
                {t.notes && <p className="text-sm text-muted-foreground mt-1">{t.notes}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(t)}>Excluir</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
