import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Webhook público da Notaas — atualiza o status do documento fiscal
// quando a Notaas processar a nota de forma assíncrona.
// URL: https://project--8dad6a77-60bd-4a17-8ef2-f4e3e97a000c.lovable.app/api/public/notaas-webhook
//
// Segurança opcional: configure o secret no painel da Notaas e em
// fiscal_settings.webhook_secret. O webhook valida o header
// X-Webhook-Secret contra esse valor.
export const Route = createFileRoute("/api/public/notaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.text();
          const payload = JSON.parse(body);

          // Notaas envia (variações): { id, status, numero, chave, pdf_url, xml_url, message }
          const notaasId = String(
            payload?.id ?? payload?.data?.id ?? payload?.nota?.id ?? ""
          );
          if (!notaasId) {
            return new Response("missing id", { status: 400 });
          }

          // Busca o documento existente para checar o secret do dono
          const { data: doc } = await supabaseAdmin
            .from("fiscal_documents")
            .select("id, user_id")
            .eq("notaas_id", notaasId)
            .maybeSingle();

          if (!doc) {
            return new Response("document not found", { status: 404 });
          }

          // Validação opcional de secret por usuário
          const { data: settings } = await supabaseAdmin
            .from("fiscal_settings")
            .select("webhook_secret")
            .eq("user_id", doc.user_id)
            .maybeSingle();

          if (settings?.webhook_secret) {
            const provided =
              request.headers.get("x-webhook-secret") ||
              request.headers.get("x-notaas-secret");
            if (provided !== settings.webhook_secret) {
              return new Response("invalid secret", { status: 401 });
            }
          }

          const rawStatus = String(
            payload?.status ?? payload?.data?.status ?? ""
          ).toLowerCase();

          const status =
            rawStatus.includes("emit") || rawStatus.includes("autoriz")
              ? "emitida"
              : rawStatus.includes("cancel")
                ? "cancelada"
                : rawStatus.includes("rejeit")
                  ? "rejeitada"
                  : rawStatus.includes("erro") || rawStatus.includes("falh")
                    ? "erro"
                    : "processando";

          await supabaseAdmin
            .from("fiscal_documents")
            .update({
              status,
              number: payload?.numero ?? payload?.data?.numero ?? undefined,
              access_key: payload?.chave ?? payload?.data?.chave ?? undefined,
              pdf_url: payload?.pdf_url ?? payload?.data?.pdf_url ?? undefined,
              xml_url: payload?.xml_url ?? payload?.data?.xml_url ?? undefined,
              return_message:
                payload?.message ?? payload?.data?.message ?? null,
            })
            .eq("id", doc.id);

          return Response.json({ ok: true });
        } catch (err: any) {
          console.error("[notaas-webhook]", err);
          return new Response(`error: ${err?.message ?? "unknown"}`, {
            status: 500,
          });
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, X-Webhook-Secret, X-Notaas-Secret",
          },
        }),
    },
  },
});
