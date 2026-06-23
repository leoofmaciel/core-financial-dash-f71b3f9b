
CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT workspace_id
  FROM public.workspace_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC, workspace_id ASC
  LIMIT 1
$function$;
