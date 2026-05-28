import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/logs";

export const Route = createFileRoute("/_authenticated/categories")({ component: CategoriesPage });

const defaults = ["Alimentação", "Combustível", "Salário", "Matéria-prima", "Ferramentas", "Marketing", "Impostos", "Outros"];

function CategoriesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1e40af");
  const [type, setType] = useState<"entrada" | "saida">("saida");

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data ?? [];
    },
  });

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const res = editing
      ? await supabase.from("categories").update({ name, color, type }).eq("id", editing.id).select().single()
      : await supabase.from("categories").insert({ user_id: user.id, name, color, type }).select().single();
    if (res.error) return toast.error(res.error.message);
    await logActivity(editing ? "update" : "create", "category", res.data?.id, { name, type });
    toast.success(editing ? "Atualizado" : "Criado");
    setOpen(false); setName(""); setEditing(null); setType("saida");
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const seedDefaults = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const rows = defaults.map((n) => ({ user_id: user.id, name: n, color: "#1e40af", type: "saida" as "saida" }));
    const { error } = await supabase.from("categories").insert(rows);
    if (error) return toast.error(error.message);
    toast.success("Categorias padrão criadas");
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const remove = async (cat: any) => {
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "category", cat.id, { name: cat.name });
    toast.success("Excluída");
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Categorias</h1>
          <p className="text-sm text-muted-foreground">Organize suas movimentações.</p>
        </div>
        <div className="flex gap-2">
          {cats.length === 0 && <Button variant="outline" onClick={seedDefaults}>Criar padrões</Button>}
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setName(""); setEditing(null); } }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); setName(""); setColor("#1e40af"); setType("saida"); }}><Plus className="h-4 w-4 mr-1" /> Nova categoria</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={(val: any) => setType(val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada (Receita)</SelectItem>
                      <SelectItem value="saida">Saída (Despesa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Cor</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c: any) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-8 w-8 rounded-lg" style={{ background: c.color }} />
                <span className="font-medium truncate">{c.name}</span>
                {c.type === "entrada" ? <ArrowUpCircle className="h-4 w-4 text-green-500" /> : <ArrowDownCircle className="h-4 w-4 text-red-500" />}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setName(c.name); setColor(c.color || "#1e40af"); setType(c.type || "saida"); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Excluir "{c.name}"?</AlertDialogTitle><AlertDialogDescription>Movimentações ficarão sem categoria.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(c)}>Excluir</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
