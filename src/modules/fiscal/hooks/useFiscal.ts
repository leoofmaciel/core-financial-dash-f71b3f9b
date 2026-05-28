import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NotaasService } from "../services/notaas";
import { NFePayload, NFSePayload, FiscalDocument } from "../types";
import { toast } from "sonner";

export function useFiscal() {
  const qc = useQueryClient();

  const listarNotas = useQuery({
    queryKey: ["fiscal_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_documents")
        .select(`*, clients(name, company), orders(id, code)`)
        .order("created_at", { ascending: false });
      
      if (error) {
        if (error.code === '42P01') {
          console.warn("Tabela fiscal_documents ainda não existe. Por favor rode o script SQL.");
          return [];
        }
        throw error;
      }
      return data as any[];
    },
  });

  const emitirNFeMutation = useMutation({
    mutationFn: async (payload: NFePayload) => {
      return NotaasService.emitirNFe(payload);
    },
    onSuccess: () => {
      toast.success("NFe enviada para processamento com sucesso!");
      qc.invalidateQueries({ queryKey: ["fiscal_documents"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao emitir NFe.");
    }
  });

  const emitirNFSeMutation = useMutation({
    mutationFn: async (payload: NFSePayload) => {
      return NotaasService.emitirNFSe(payload);
    },
    onSuccess: () => {
      toast.success("NFS-e enviada para processamento com sucesso!");
      qc.invalidateQueries({ queryKey: ["fiscal_documents"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao emitir NFS-e.");
    }
  });

  const cancelarNotaMutation = useMutation({
    mutationFn: async ({ idNota, justificativa }: { idNota: string, justificativa: string }) => {
      return NotaasService.cancelarNota(idNota, justificativa);
    },
    onSuccess: () => {
      toast.success("Solicitação de cancelamento enviada!");
      qc.invalidateQueries({ queryKey: ["fiscal_documents"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao cancelar nota.");
    }
  });

  return {
    listarNotas,
    emitirNFe: emitirNFeMutation,
    emitirNFSe: emitirNFSeMutation,
    cancelarNota: cancelarNotaMutation
  };
}
