import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ModuleKey =
  | "dashboard" | "clients" | "orders" | "budgets" | "transactions"
  | "categories" | "recurrences" | "investments" | "partners" | "tasks"
  | "fiscal" | "reports" | "settings" | "users";

export type Permission = { module: ModuleKey; can_view: boolean; can_edit: boolean };

export type MyPermissions = {
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  role: "owner" | "admin" | "member" | null;
  workspaceId: string | null;
  memberId: string | null;
  canView: (m: ModuleKey) => boolean;
  canEdit: (m: ModuleKey) => boolean;
};

export function useMyPermissions(): MyPermissions {
  const { data, isLoading } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: member } = await supabase
        .from("workspace_members")
        .select("id, workspace_id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!member) return null;
      const { data: perms } = await supabase
        .from("module_permissions")
        .select("module, can_view, can_edit")
        .eq("member_id", member.id);
      return { member, perms: (perms ?? []) as Permission[] };
    },
    staleTime: 60_000,
  });

  const role = data?.member?.role ?? null;
  const isOwner = role === "owner";
  const isAdmin = role === "owner" || role === "admin";
  const permMap = new Map<string, Permission>(
    (data?.perms ?? []).map((p) => [p.module, p]),
  );

  return {
    loading: isLoading,
    isOwner,
    isAdmin,
    role: role as any,
    workspaceId: data?.member?.workspace_id ?? null,
    memberId: data?.member?.id ?? null,
    canView: (m) => isAdmin || !!permMap.get(m)?.can_view,
    canEdit: (m) => isAdmin || !!permMap.get(m)?.can_edit,
  };
}
