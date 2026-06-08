-- Restrict activity_logs reads to workspace admins
DROP POLICY IF EXISTS "logs select" ON public.activity_logs;
CREATE POLICY "logs select" ON public.activity_logs
  FOR SELECT
  USING (workspace_id = public.current_workspace_id() AND public.is_workspace_admin());

-- Restrict fiscal_settings reads to workspace admins (contains webhook_secret / cnpj)
DROP POLICY IF EXISTS "ws select" ON public.fiscal_settings;
CREATE POLICY "ws select" ON public.fiscal_settings
  FOR SELECT
  USING (workspace_id = public.current_workspace_id() AND public.is_workspace_admin());

-- Add missing UPDATE policy on order-attachments storage bucket
CREATE POLICY "oa bucket update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'order-attachments' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'order-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
