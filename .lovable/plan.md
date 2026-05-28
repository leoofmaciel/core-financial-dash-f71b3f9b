# Plano: Plataforma Operacional Moderna

O pedido é grande. Vou propor um plano em **fases entregáveis**, cada uma utilizável de imediato, para evitar um único PR gigante e instável.

---

## Fase 1 — Hub Operacional do Pedido (modal fullscreen)

Tela única para operar todo o pedido sem reloads.

- Novo componente `OrderHubDialog` (modal fullscreen) acionado a partir de `orders/index.tsx` e do Copiloto.
- **Header fixo**: nº pedido, status (badge clicável p/ trocar), cliente, botões rápidos (Salvar, PDF, Enviar).
- **Coluna esquerda**: dados do cliente + botão "Novo cliente" inline (mini-form em popover).
- **Centro**: itens (add/edit/remove), descontos, subtotal/total em tempo real.
- **Coluna direita**: status financeiro (conta a receber vinculada), ações rápidas (aprovar/marcar pago), histórico (`activity_logs` filtrado por entity_id), observações.
- **Footer fixo**: total, Salvar, Download PDF, Enviar orçamento.
- Auto-save (debounce 1.5s) + toast discreto "salvo".
- Mantém rota `/orders/$id` como fallback (deep-link).

## Fase 2 — Anexos + Exclusão em cascata

- Migration: nova tabela `order_attachments` (order_id, file_url, name, size, mime, uploaded_by) + bucket `order-attachments` privado com RLS.
- Upload drag-drop dentro do Hub.
- Migration: `ON DELETE CASCADE` em `order_items`, `order_materials`, `budgets`, `budget_items`, `order_attachments`, e `transactions.order_id`.
- Modal de confirmação elegante listando o que será removido (itens, orçamentos, contas, anexos).

## Fase 3 — Envio por WhatsApp e E-mail

**WhatsApp** (MVP via wa.me):
- Botão "Enviar por WhatsApp" gera PDF, salva no bucket, abre `https://wa.me/<phone>?text=<mensagem>` em nova aba com mensagem template editável antes.
- Limitação: WhatsApp Web não aceita anexo automático via URL. Solução: link público do PDF (signed URL 7 dias) embutido na mensagem. Estrutura preparada para futura API oficial.

**E-mail** (via Lovable Email — sem precisar conectar provedor externo):
- Configurar domínio de envio (`email_domain` setup).
- Server function `sendBudgetEmail` que renderiza template + anexa PDF + registra em nova tabela `order_communications`.
- Modal de envio com assunto/mensagem editáveis e preview.

**Tabela `order_communications`**: order_id, channel (whatsapp|email), status (sent|viewed|...), recipient, subject, body, pdf_url, sent_at, sent_by — alimenta histórico e habilita reenvio rápido + futuros follow-ups automáticos.

## Fase 4 — Status estendidos + templates

- Enum `order_status` ampliado: `orcamento_enviado`, `visualizado`, `aguardando_retorno`, `aprovado`, `cancelado` (mantém compatibilidade).
- Tabela `message_templates` (tipo, assunto, corpo) editável em Configurações.

## Fase 5 — Copiloto com etapas puláveis

- Cada etapa do `Copilot` ganha botão "Pular por enquanto".
- Stepper mostra etapas puladas com ícone âmbar; permite voltar a qualquer momento.
- Apenas campos realmente obrigatórios bloqueiam (cliente + ao menos 1 item para gerar orçamento).

## Fase 6 — Polimentos UX

- Menu mobile: fechar `Sidebar` automaticamente ao navegar (usar `useSidebar().setOpenMobile(false)` no `AppSidebar` nav links).
- Transições suaves, feedback de auto-save global, busca inteligente já existe (`GlobalSearch`) — apenas refinar.

---

## Detalhes técnicos

- Stack mantido: TanStack Start + Supabase + shadcn/ui + TanStack Query.
- Toda lógica server-sensitive em `createServerFn` ou direto via supabase client (RLS já cobre — projeto single-tenant).
- `activity_logs` já existe e é usado em todas as ações para histórico por usuário.
- PDF: reaproveita `generateBudgetPDF` em `src/lib/pdf.ts`.
- Sem multi-tenant: nenhuma mudança de schema nesse sentido.

---

## Como gostaria de prosseguir

O escopo é grande demais para um único turno sem virar uma bagunça. Sugiro **começar pela Fase 1 (Hub do Pedido)** agora — é a mudança de maior impacto visual/operacional e desbloqueia as demais.

Confirma que posso começar pela Fase 1, ou prefere reordenar (ex: WhatsApp/E-mail primeiro, ou cascade delete primeiro)?
