import { callNotaas } from "@/lib/notaas.functions";
import { NFePayload, NFSePayload, FiscalDocumentType } from "../types";

const invoke = async (action: string, payload: any) => {
  return await callNotaas({ data: { action: action as any, payload } });
};

export const NotaasService = {
  emitirNFe: (payload: NFePayload) => invoke("EMITIR_NFE", payload),
  emitirNFSe: (payload: NFSePayload) => invoke("EMITIR_NFSE", payload),
  consultarNota: (idNota: string, type: FiscalDocumentType) => invoke("CONSULTAR_NOTA", { idNota, type }),
  cancelarNota: (idNota: string, justificativa: string, type: FiscalDocumentType = "nfe") =>
    invoke("CANCELAR_NOTA", { idNota, justificativa, type }),
  baixarPDF: (idNota: string) => invoke("BAIXAR_PDF", { idNota }),
};
