
ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS certificado_path text,
  ADD COLUMN IF NOT EXISTS certificado_nome text,
  ADD COLUMN IF NOT EXISTS certificado_senha text,
  ADD COLUMN IF NOT EXISTS certificado_validade date,
  ADD COLUMN IF NOT EXISTS certificado_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS certificado_notaas_id text,
  ADD COLUMN IF NOT EXISTS serie_rps text DEFAULT '1',
  ADD COLUMN IF NOT EXISTS proximo_numero_rps integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ambiente text DEFAULT 'homologacao';
