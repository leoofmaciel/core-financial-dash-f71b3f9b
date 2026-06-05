
CREATE OR REPLACE FUNCTION public.can_view(_module module_key)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    LEFT JOIN public.module_permissions p
      ON p.member_id = m.id AND p.module = _module
    WHERE m.user_id = auth.uid()
      AND m.workspace_id = public.current_workspace_id()
      AND (m.role IN ('owner','admin') OR COALESCE(p.can_view, false))
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_edit(_module module_key)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    LEFT JOIN public.module_permissions p
      ON p.member_id = m.id AND p.module = _module
    WHERE m.user_id = auth.uid()
      AND m.workspace_id = public.current_workspace_id()
      AND (m.role IN ('owner','admin') OR COALESCE(p.can_edit, false))
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = auth.uid()
      AND workspace_id = public.current_workspace_id()
      AND role IN ('owner','admin')
  )
$function$;

-- Revoga execução pública de funções SECURITY DEFINER sensíveis
REVOKE EXECUTE ON FUNCTION public.can_view(module_key) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_edit(module_key) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_workspace_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.can_view(module_key) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit(module_key) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_workspace_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
