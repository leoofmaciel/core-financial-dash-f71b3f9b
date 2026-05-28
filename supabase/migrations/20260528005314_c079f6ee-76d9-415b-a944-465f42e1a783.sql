
-- Extend order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'orcamento_enviado';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'visualizado';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'aguardando_retorno';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelado';

-- order_attachments
CREATE TABLE public.order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_url text,
  name text NOT NULL,
  size bigint,
  mime text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_attachments TO authenticated;
GRANT ALL ON public.order_attachments TO service_role;
ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oa select" ON public.order_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_attachments.order_id AND (o.user_id = auth.uid() OR is_admin(auth.uid())))
);
CREATE POLICY "oa insert" ON public.order_attachments FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_attachments.order_id AND o.user_id = auth.uid())
);
CREATE POLICY "oa delete" ON public.order_attachments FOR DELETE USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_attachments.order_id AND (o.user_id = auth.uid() OR is_admin(auth.uid())))
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('order-attachments', 'order-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "oa bucket select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'order-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "oa bucket insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "oa bucket delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'order-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- order_communications
CREATE TABLE public.order_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email')),
  status text NOT NULL DEFAULT 'sent',
  recipient text,
  subject text,
  body text,
  pdf_url text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_communications TO authenticated;
GRANT ALL ON public.order_communications TO service_role;
ALTER TABLE public.order_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oc select" ON public.order_communications FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_communications.order_id AND (o.user_id = auth.uid() OR is_admin(auth.uid())))
);
CREATE POLICY "oc insert" ON public.order_communications FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_communications.order_id AND o.user_id = auth.uid())
);

-- message_templates
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email')),
  subject text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mt select" ON public.message_templates FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "mt insert" ON public.message_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mt update" ON public.message_templates FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "mt delete" ON public.message_templates FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));
