import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  action: string,
  entity: string,
  entity_id?: string | null,
  details?: Record<string, unknown>,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action,
    entity,
    entity_id: entity_id ?? null,
    details: (details ?? null) as never,
  });
}
