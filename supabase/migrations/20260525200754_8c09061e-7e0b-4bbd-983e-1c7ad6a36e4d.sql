-- 1. Drop duplicate attachments storage policies
DROP POLICY IF EXISTS "att owner read" ON storage.objects;
DROP POLICY IF EXISTS "att owner upload" ON storage.objects;
DROP POLICY IF EXISTS "att owner delete" ON storage.objects;

-- 2. Harden user_roles admin policy with explicit WITH CHECK
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 3. Revoke EXECUTE on trigger-only SECURITY DEFINER function from clients
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
