export type FiscalDocumentType = "nfe" | "nfse";

export type FiscalDocumentStatus = "processando" | "emitida" | "cancelada" | "rejeitada" | "erro";

export interface FiscalDocument {
  id: string;
  user_id: string;
  type: FiscalDocumentType;
  number?: string;
  series?: string;
  access_key?: string;
  status: FiscalDocumentStatus;
  client_id?: string;
  order_id?: string;
  total_amount: number;
  xml_url?: string;
  pdf_url?: string;
  payload?: any;
  return_message?: string;
  created_at: string;
  updated_at: string;
}

// Payload de Emissão NFe (Baseado no padrão Nacional)
export interface NFePayload {
  natureza_operacao: string;
  cliente: {
    cpf_cnpj: string;
    razao_social: string;
    inscricao_estadual?: string;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      municipio: string;
      uf: string;
      cep: string;
    };
  };
  itens: Array<{
    codigo: string;
    descricao: string;
    ncm: string;
    cfop: string;
    quantidade: number;
    valor_unitario: number;
    impostos: {
      icms: { cst: string; aliquota: number };
      pis: { cst: string; aliquota: number };
      cofins: { cst: string; aliquota: number };
    };
  }>;
}

// Payload de Emissão NFS-e (Baseado no padrão Nacional)
export interface NFSePayload {
  servico: {
    codigo_tributacao_municipio: string;
    discriminacao: string;
    codigo_municipio: string;
    valor_servicos: number;
    iss_retido: boolean;
    aliquota: number;
  };
  tomador: {
    cpf_cnpj: string;
    razao_social: string;
    email?: string;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      codigo_municipio: string;
      uf: string;
      cep: string;
    };
  };
}
