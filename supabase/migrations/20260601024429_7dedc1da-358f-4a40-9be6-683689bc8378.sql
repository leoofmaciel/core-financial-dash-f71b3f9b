-- activity_logs: restrict UPDATE/DELETE to owner or admin
CREATE POLICY "log update" ON public.activity_logs
FOR UPDATE USING ((auth.uid() = user_id) OR is_admin(auth.uid()))
WITH CHECK ((auth.uid() = user_id) OR is_admin(auth.uid()));

CREATE POLICY "log delete" ON public.activity_logs
FOR DELETE USING ((auth.uid() = user_id) OR is_admin(auth.uid()));

-- order_attachments: add UPDATE policy mirroring DELETE
CREATE POLICY "oa update" ON public.order_attachments
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_attachments.order_id
    AND (o.user_id = auth.uid() OR is_admin(auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_attachments.order_id
    AND (o.user_id = auth.uid() OR is_admin(auth.uid()))
));

-- order_communications: add UPDATE and DELETE policies
CREATE POLICY "oc update" ON public.order_communications
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_communications.order_id
    AND (o.user_id = auth.uid() OR is_admin(auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_communications.order_id
    AND (o.user_id = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "oc delete" ON public.order_communications
FOR DELETE USING (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_communications.order_id
    AND (o.user_id = auth.uid() OR is_admin(auth.uid()))
));

-- user_roles: explicitly block non-admin INSERT/UPDATE/DELETE to prevent privilege escalation
CREATE POLICY "Only admins can insert roles" ON public.user_roles
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update roles" ON public.user_roles
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete roles" ON public.user_roles
AS RESTRICTIVE FOR DELETE TO authenticated
USING (is_admin(auth.uid()));