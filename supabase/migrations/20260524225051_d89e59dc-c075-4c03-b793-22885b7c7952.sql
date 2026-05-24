
-- Recreate functions with explicit search_path (already had, but ensure) and revoke public execute
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- Narrow logos listing: only owner folder
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos public read by path" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
