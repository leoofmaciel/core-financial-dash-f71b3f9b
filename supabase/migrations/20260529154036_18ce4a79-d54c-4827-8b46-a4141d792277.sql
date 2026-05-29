
CREATE TABLE public.fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('nfe','nfse')),
  number text,
  series text,
  access_key text,
  status text NOT NULL DEFAULT 'processando',
  client_id uuid,
  order_id uuid,
  total_amount numeric NOT NULL DEFAULT 0,
  xml_url text,
  pdf_url text,
  notaas_id text,
  payload jsonb,
  return_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiscal_documents_user ON public.fiscal_documents(user_id);
CREATE INDEX idx_fiscal_documents_order ON public.fiscal_documents(order_id);
CREATE INDEX idx_fiscal_documents_client ON public.fiscal_documents(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_documents TO authenticated;
GRANT ALL ON public.fiscal_documents TO service_role;

ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fd select" ON public.fiscal_documents
  FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "fd insert" ON public.fiscal_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fd update" ON public.fiscal_documents
  FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "fd delete" ON public.fiscal_documents
  FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE TRIGGER trg_fiscal_documents_updated_at
  BEFORE UPDATE ON public.fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
