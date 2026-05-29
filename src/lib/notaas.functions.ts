import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notaasApi } from "./notaas.server";

type Action =
  | "EMITIR_NFE"
  | "EMITIR_NFSE"
  | "CONSULTAR_NOTA"
  | "CANCELAR_NOTA"
  | "BAIXAR_PDF";

export const callNotaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { action: Action; payload: any }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { action, payload } = data;

    if (action === "EMITIR_NFE") {
      const inserted = await supabase.from("fiscal_documents").insert({
        user_id: userId,
        type: "nfe",
        status: "processando",
        total_amount: (payload?.itens || []).reduce(
          (s: number, i: any) => s + Number(i.quantidade || 0) * Number(i.valor_unitario || 0), 0
        ),
        payload,
      }).select().single();
      if (inserted.error) throw new Error(inserted.error.message);

      try {
        const res = await notaasApi.emitirNFe(payload);
        await supabase.from("fiscal_documents").update({
          notaas_id: res?.id || res?.data?.id,
          status: res?.status === "emitida" ? "emitida" : "processando",
          number: res?.numero || res?.data?.numero,
          access_key: res?.chave || res?.data?.chave,
          pdf_url: res?.pdf_url || res?.data?.pdf_url,
          xml_url: res?.xml_url || res?.data?.xml_url,
          return_message: res?.message || null,
        }).eq("id", inserted.data.id);
        return { ok: true, document_id: inserted.data.id, notaas: res };
      } catch (err: any) {
        await supabase.from("fiscal_documents").update({
          status: "erro", return_message: err.message,
        }).eq("id", inserted.data.id);
        throw err;
      }
    }

    if (action === "EMITIR_NFSE") {
      const inserted = await supabase.from("fiscal_documents").insert({
        user_id: userId, type: "nfse", status: "processando",
        total_amount: Number(payload?.servico?.valor_servicos || 0),
        payload,
      }).select().single();
      if (inserted.error) throw new Error(inserted.error.message);

      try {
        const res = await notaasApi.emitirNFSe(payload);
        await supabase.from("fiscal_documents").update({
          notaas_id: res?.id || res?.data?.id,
          status: res?.status === "emitida" ? "emitida" : "processando",
          number: res?.numero || res?.data?.numero,
          pdf_url: res?.pdf_url || res?.data?.pdf_url,
          xml_url: res?.xml_url || res?.data?.xml_url,
          return_message: res?.message || null,
        }).eq("id", inserted.data.id);
        return { ok: true, document_id: inserted.data.id, notaas: res };
      } catch (err: any) {
        await supabase.from("fiscal_documents").update({
          status: "erro", return_message: err.message,
        }).eq("id", inserted.data.id);
        throw err;
      }
    }

    if (action === "CONSULTAR_NOTA") {
      const { idNota, type } = payload;
      const res = type === "nfse" ? await notaasApi.consultarNFSe(idNota) : await notaasApi.consultarNFe(idNota);
      return res;
    }

    if (action === "CANCELAR_NOTA") {
      const { idNota, justificativa, type } = payload;
      const res = type === "nfse"
        ? await notaasApi.cancelarNFSe(idNota, justificativa)
        : await notaasApi.cancelarNFe(idNota, justificativa);
      await supabase.from("fiscal_documents").update({ status: "cancelada" }).eq("notaas_id", idNota);
      return res;
    }

    if (action === "BAIXAR_PDF") {
      const { idNota } = payload;
      const res = await notaasApi.consultarNFe(idNota);
      return { pdf_url: res?.pdf_url || res?.data?.pdf_url };
    }

    throw new Error(`Ação desconhecida: ${action}`);
  });
