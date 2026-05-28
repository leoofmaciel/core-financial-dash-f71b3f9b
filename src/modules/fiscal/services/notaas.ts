import { supabase } from "@/integrations/supabase/client";
import { NFePayload, NFSePayload, FiscalDocumentType } from "../types";

// This service will communicate with our secure Supabase Edge Function
// The edge function will inject the VITE_NOTAAS_CLIENT_SECRET and API_KEY.

const invokeNotaasFunction = async (action: string, payload: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Usuário não autenticado");

  // Chamada para a Edge Function que gerencia a comunicação segura com a API Notaas
  const { data, error } = await supabase.functions.invoke("notaas-api", {
    body: { action, payload },
  });

  if (error) {
    throw new Error(error.message || "Erro de comunicação com o servidor fiscal.");
  }

  if (data?.error) {
    throw new Error(data.error || "Erro retornado pela API Notaas.");
  }

  return data;
};

export const NotaasService = {
  /**
   * Emite uma NFe de Produto
   */
  async emitirNFe(payload: NFePayload) {
    return invokeNotaasFunction("EMITIR_NFE", payload);
  },

  /**
   * Emite uma NFS-e de Serviço
   */
  async emitirNFSe(payload: NFSePayload) {
    return invokeNotaasFunction("EMITIR_NFSE", payload);
  },

  /**
   * Consulta o status de uma nota na SEFAZ/Prefeitura
   */
  async consultarNota(idNota: string, type: FiscalDocumentType) {
    return invokeNotaasFunction("CONSULTAR_NOTA", { idNota, type });
  },

  /**
   * Cancela uma nota já emitida
   */
  async cancelarNota(idNota: string, justificativa: string) {
    return invokeNotaasFunction("CANCELAR_NOTA", { idNota, justificativa });
  },

  /**
   * Baixa o PDF (DANFE/XML) de uma nota
   */
  async baixarPDF(idNota: string) {
    return invokeNotaasFunction("BAIXAR_PDF", { idNota });
  },
};
