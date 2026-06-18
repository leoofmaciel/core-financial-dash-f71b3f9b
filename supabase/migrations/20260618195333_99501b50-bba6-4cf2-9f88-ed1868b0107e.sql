
-- Add missing fiscal fields needed for NFS-e emission
ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS cnae text,
  ADD COLUMN IF NOT EXISTS item_lista_servico text,
  ADD COLUMN IF NOT EXISTS regime_tributario text DEFAULT 'simples_nacional',
  ADD COLUMN IF NOT EXISTS optante_simples_nacional boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS incentivador_cultural boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS regime_especial_tributacao text,
  ADD COLUMN IF NOT EXISTS endereco_logradouro text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS endereco_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_cep text,
  ADD COLUMN IF NOT EXISTS endereco_municipio text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text;

-- Add address breakdown + IE/IM to clients (for NFSe tomador)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS endereco_logradouro text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS endereco_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_cep text,
  ADD COLUMN IF NOT EXISTS endereco_municipio text,
  ADD COLUMN IF NOT EXISTS codigo_municipio_ibge text,
  ADD COLUMN IF NOT EXISTS endereco_uf text;
