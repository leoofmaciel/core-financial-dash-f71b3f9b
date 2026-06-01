import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MODULE_KEYS = [
  "dashboard","clients","orders","budgets","transactions","categories",
  "recurrences","investments","partners","tasks","fiscal","reports",
  "settings","users",
] as const;

const moduleKey = z.enum(MODULE_KEYS);

const permissionSchema = z.object({
  module: moduleKey,
  can_view: z.boolean(),
  can_edit: z.boolean(),
});

async function assertWorkspaceAdmin(supabase: any, userId: string) {
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id, workspace_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    throw new Error("Apenas administradores do workspace podem executar essa ação.");
  }
  return member as { id: string; workspace_id: string; role: "owner" | "admin" };
}

// ============== CREATE USER ==============
const createSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  full_name: z.string().min(1).max(120),
  role: z.enum(["admin", "member"]).default("member"),
  permissions: z.array(permissionSchema).default([]),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const adminMember = await assertWorkspaceAdmin(supabase, userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message || "Falha ao criar usuário");
    const newUserId = created.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      email: data.email,
      full_name: data.full_name,
    });

    // Workspace member
    const { data: member, error: memberErr } = await supabaseAdmin
      .from("workspace_members")
      .insert({
        workspace_id: adminMember.workspace_id,
        user_id: newUserId,
        role: data.role,
      })
      .select()
      .single();
    if (memberErr) throw new Error(memberErr.message);

    // Permissions (only for member; admin/owner ignored — has full access)
    if (data.role === "member" && data.permissions.length > 0) {
      const rows = data.permissions.map((p) => ({
        member_id: member.id,
        module: p.module,
        can_view: p.can_view,
        can_edit: p.can_edit,
      }));
      await supabaseAdmin.from("module_permissions").insert(rows);
    }

    // Keep legacy user_roles in sync (for is_admin())
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: data.role === "admin" ? "admin" : "user",
    });

    return { id: newUserId, member_id: member.id };
  });

// ============== UPDATE MEMBER ==============
const updateSchema = z.object({
  member_id: z.string().uuid(),
  role: z.enum(["admin", "member"]),
  permissions: z.array(permissionSchema).default([]),
});

export const adminUpdateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const adminMember = await assertWorkspaceAdmin(supabase, userId);

    const { data: target } = await supabaseAdmin
      .from("workspace_members")
      .select("id, workspace_id, user_id, role")
      .eq("id", data.member_id)
      .maybeSingle();
    if (!target) throw new Error("Membro não encontrado");
    if (target.workspace_id !== adminMember.workspace_id) throw new Error("Membro de outro workspace");
    if (target.role === "owner") throw new Error("Owner não pode ser alterado");

    await supabaseAdmin
      .from("workspace_members")
      .update({ role: data.role })
      .eq("id", data.member_id);

    await supabaseAdmin.from("module_permissions").delete().eq("member_id", data.member_id);
    if (data.role === "member" && data.permissions.length > 0) {
      await supabaseAdmin.from("module_permissions").insert(
        data.permissions.map((p) => ({
          member_id: data.member_id,
          module: p.module,
          can_view: p.can_view,
          can_edit: p.can_edit,
        })),
      );
    }

    // Sync legacy
    await supabaseAdmin.from("user_roles").delete().eq("user_id", target.user_id);
    await supabaseAdmin.from("user_roles").insert({
      user_id: target.user_id,
      role: data.role === "admin" ? "admin" : "user",
    });

    return { ok: true };
  });

// ============== REMOVE MEMBER ==============
const removeSchema = z.object({ member_id: z.string().uuid() });

export const adminRemoveMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => removeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const adminMember = await assertWorkspaceAdmin(supabase, userId);

    const { data: target } = await supabaseAdmin
      .from("workspace_members")
      .select("id, workspace_id, role")
      .eq("id", data.member_id)
      .maybeSingle();
    if (!target) throw new Error("Membro não encontrado");
    if (target.workspace_id !== adminMember.workspace_id) throw new Error("Membro de outro workspace");
    if (target.role === "owner") throw new Error("Owner não pode ser removido");

    await supabaseAdmin.from("workspace_members").delete().eq("id", data.member_id);
    return { ok: true };
  });
