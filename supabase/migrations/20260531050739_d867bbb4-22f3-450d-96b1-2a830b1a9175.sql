CREATE TABLE public.fiscal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  cnpj_emissor text,
  razao_social text,
  inscricao_municipal text,
  codigo_municipio text DEFAULT '3550308',
  uf text DEFAULT 'SP',
  ncm_padrao text DEFAULT '00000000',
  cfop_padrao text DEFAULT '5102',
  codigo_tributacao_municipio text DEFAULT '14.01',
  aliquota_iss numeric DEFAULT 5,
  iss_retido boolean DEFAULT false,
  natureza_operacao text DEFAULT 'Venda',
  webhook_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_settings TO authenticated;
GRANT ALL ON public.fiscal_settings TO service_role;

ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fs select" ON public.fiscal_settings FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "fs insert" ON public.fiscal_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fs update" ON public.fiscal_settings FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "fs delete" ON public.fiscal_settings FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE TRIGGER fiscal_settings_updated_at BEFORE UPDATE ON public.fiscal_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();