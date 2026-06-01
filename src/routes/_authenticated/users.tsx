import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { adminCreateUser, adminUpdateMember, adminRemoveMember } from "@/lib/admin-users.functions";

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "clients", label: "Clientes" },
  { key: "orders", label: "Pedidos" },
  { key: "budgets", label: "Orçamentos" },
  { key: "transactions", label: "Financeiro" },
  { key: "categories", label: "Categorias" },
  { key: "recurrences", label: "Recorrências" },
  { key: "investments", label: "Investimentos" },
  { key: "partners", label: "Sócios" },
  { key: "tasks", label: "Tarefas" },
  { key: "fiscal", label: "Fiscal" },
  { key: "reports", label: "Relatórios" },
  { key: "settings", label: "Configurações" },
  { key: "users", label: "Usuários" },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];
type Perm = { module: ModuleKey; can_view: boolean; can_edit: boolean };

const emptyPerms = (): Perm[] =>
  MODULES.map((m) => ({ module: m.key, can_view: false, can_edit: false }));

export const Route = createFileRoute("/_authenticated/users")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: m } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!m || (m.role !== "owner" && m.role !== "admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const createUserFn = useServerFn(adminCreateUser);
  const updateMemberFn = useServerFn(adminUpdateMember);
  const removeMemberFn = useServerFn(adminRemoveMember);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ member_id: string; full_name: string } | null>(null);

  const [form, setForm] = useState<{
    full_name: string; email: string; password: string;
    role: "member" | "admin"; permissions: Perm[];
  }>({ full_name: "", email: "", password: "", role: "member", permissions: emptyPerms() });

  const [editForm, setEditForm] = useState<{
    role: "member" | "admin"; permissions: Perm[];
  }>({ role: "member", permissions: emptyPerms() });

  const { data: rows = [] } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: async () => {
      const { data: members } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, created_at")
        .order("created_at", { ascending: false });
      const ids = (members ?? []).map((m: any) => m.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
        : { data: [] as any[] };
      const memberIds = (members ?? []).map((m: any) => m.id);
      const { data: perms } = memberIds.length
        ? await supabase.from("module_permissions").select("*").in("member_id", memberIds)
        : { data: [] as any[] };
      return (members ?? []).map((m: any) => ({
        ...m,
        profile: (profiles ?? []).find((p: any) => p.id === m.user_id),
        permissions: (perms ?? []).filter((p: any) => p.member_id === m.id),
      }));
    },
  });

  const togglePerm = (
    list: Perm[], setList: (p: Perm[]) => void,
    mod: ModuleKey, field: "can_view" | "can_edit", value: boolean,
  ) => {
    setList(list.map((p) => {
      if (p.module !== mod) return p;
      const next = { ...p, [field]: value };
      if (field === "can_edit" && value) next.can_view = true;
      if (field === "can_view" && !value) next.can_edit = false;
      return next;
    }));
  };

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) return toast.error("Preencha todos os campos");
    setSaving(true);
    try {
      await createUserFn({ data: form });
      toast.success("Usuário criado");
      setCreateOpen(false);
      setForm({ full_name: "", email: "", password: "", role: "member", permissions: emptyPerms() });
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao criar usuário");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: any) => {
    const merged = emptyPerms().map((p) => {
      const found = row.permissions.find((x: any) => x.module === p.module);
      return found ? { module: p.module, can_view: found.can_view, can_edit: found.can_edit } : p;
    });
    setEditing({ member_id: row.id, full_name: row.profile?.full_name ?? row.profile?.email ?? "Usuário" });
    setEditForm({ role: row.role === "admin" ? "admin" : "member", permissions: merged });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateMemberFn({ data: { member_id: editing.member_id, ...editForm } });
      toast.success("Permissões atualizadas");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (member_id: string) => {
    if (!confirm("Remover este usuário do workspace?")) return;
    try {
      await removeMemberFn({ data: { member_id } });
      toast.success("Usuário removido");
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao remover");
    }
  };

  const PermissionsGrid = ({
    perms, onChange, disabled,
  }: { perms: Perm[]; onChange: (p: Perm[]) => void; disabled?: boolean }) => (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2 font-medium">Módulo</th>
            <th className="p-2 font-medium w-20">Ver</th>
            <th className="p-2 font-medium w-20">Editar</th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m) => {
            const p = perms.find((x) => x.module === m.key)!;
            return (
              <tr key={m.key} className="border-t">
                <td className="p-2">{m.label}</td>
                <td className="p-2 text-center">
                  <Checkbox
                    checked={p.can_view}
                    disabled={disabled}
                    onCheckedChange={(v) => togglePerm(perms, onChange, m.key, "can_view", !!v)}
                  />
                </td>
                <td className="p-2 text-center">
                  <Checkbox
                    checked={p.can_edit}
                    disabled={disabled}
                    onCheckedChange={(v) => togglePerm(perms, onChange, m.key, "can_edit", !!v)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie membros do workspace e permissões por módulo.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Novo usuário</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Criar novo usuário</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Senha provisória</Label>
                  <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={form.role} onValueChange={(v: "member" | "admin") => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Permissões por módulo</Label>
                {form.role === "admin" ? (
                  <p className="text-sm text-muted-foreground">Administradores têm acesso total a todos os módulos.</p>
                ) : (
                  <PermissionsGrid perms={form.permissions} onChange={(p) => setForm({ ...form, permissions: p })} />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.profile?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.profile?.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "owner" ? "default" : u.role === "admin" ? "secondary" : "outline"}>
                      {u.role === "owner" ? "Owner" : u.role === "admin" ? "Admin" : "Membro"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {u.role !== "owner" && (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleRemove(u.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar {editing?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={editForm.role} onValueChange={(v: "member" | "admin") => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissões por módulo</Label>
              {editForm.role === "admin" ? (
                <p className="text-sm text-muted-foreground">Administradores têm acesso total a todos os módulos.</p>
              ) : (
                <PermissionsGrid perms={editForm.permissions} onChange={(p) => setEditForm({ ...editForm, permissions: p })} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
