CREATE POLICY "Users update own attachments"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'attachments' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'attachments' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "cs delete"
ON public.company_settings
FOR DELETE
USING ((auth.uid() = user_id) OR is_admin(auth.uid()));