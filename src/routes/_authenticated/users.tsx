import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!data?.some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profiles ?? []).map((p: any) => ({ ...p, roles: (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role) }));
    },
  });

  const setRole = async (userId: string, role: "admin" | "user") => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success("Papel atualizado");
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Usuários</h1>
        <p className="text-sm text-muted-foreground">Gerencie papéis dos usuários.</p>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Papel</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {u.roles.map((r: string) => <Badge key={r} className="mr-1">{r}</Badge>)}
                  </TableCell>
                  <TableCell>
                    <Select value={u.roles[0] ?? "user"} onValueChange={(v: "admin" | "user") => setRole(u.id, v)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
