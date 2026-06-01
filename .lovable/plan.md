# Sistema multiusuário com workspace compartilhado

## Visão geral

Hoje cada tabela do sistema filtra dados por `user_id = auth.uid()` — cada usuário enxerga só os seus. Vamos transformar isso num modelo onde **todos os usuários do workspace do `lmaciel66@gmail.com` operam na mesma base de dados**, e o admin controla, por usuário e por módulo, quem pode ver e quem pode editar.

## O que será criado

### 1. Estrutura de workspace

- **`workspaces`** — tabela com o "espaço" compartilhado (id, nome, owner_id). O `lmaciel66@gmail.com` vira owner do primeiro workspace.
- **`workspace_members`** — vínculo usuário ↔ workspace, com papel: `owner`, `admin`, `member`. O owner sempre tem acesso total.
- **`module_permissions`** — para cada membro, marca em quais módulos ele tem `view` e/ou `edit`. Módulos:
  - `dashboard`, `clients`, `orders`, `budgets`, `transactions`, `categories`, `recurrences`, `investments`, `partners`, `tasks`, `fiscal`, `reports`, `settings`, `users`

### 2. Migração das tabelas existentes

Todas as tabelas de dados ganham coluna `workspace_id` (nullable inicialmente). Backfill atribui o workspace do `lmaciel66@gmail.com` a todos os registros existentes. Depois a coluna vira `NOT NULL`.

Tabelas afetadas: `clients`, `orders`, `order_items`, `order_materials`, `order_attachments`, `order_communications`, `budgets`, `budget_items`, `transactions`, `categories`, `recurrences`, `investments`, `investment_payments`, `partners`, `tasks`, `message_templates`, `company_settings`, `fiscal_documents`, `fiscal_settings`, `activity_logs`.

### 3. Novas RLS policies

Substituem o filtro `auth.uid() = user_id` por:

```text
SELECT: usuário é membro do workspace E tem permissão `view` no módulo
INSERT/UPDATE/DELETE: usuário é membro do workspace E tem permissão `edit` no módulo
```

Implementado via funções `SECURITY DEFINER`:
- `is_workspace_member(workspace_id)` — checa vínculo
- `can_view(workspace_id, module)` — owner/admin sempre `true`; membro respeita `module_permissions`
- `can_edit(workspace_id, module)` — idem

O `user_id` original de cada registro fica preservado (vira "criado por") só pra auditoria, mas não é mais usado em RLS.

### 4. Telas

- **Usuários** (`/users`, só admin) — substitui a tela atual:
  - Lista membros do workspace com papel e resumo das permissões
  - Botão "Criar usuário" → modal com email + senha provisória + papel + checkboxes por módulo (view/edit)
  - Editar membro (alterar papel e permissões)
  - Remover membro (mantém o registro do auth, só desvincula)
- **Cadastro público desabilitado** — `/signup` deixa de ser acessível; rota redireciona pra `/login` com aviso "Solicite uma conta ao administrador".
- **Sidebar** — itens ficam ocultos quando o usuário não tem `view` no módulo.

### 5. Backend

- Server function `createWorkspaceMember` (admin-only): cria usuário no auth via `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`, insere em `workspace_members` e `module_permissions`.
- Server function `updateMemberPermissions` (admin-only).
- Server function `removeMember` (admin-only).
- Hook `useMyPermissions()` carrega permissões do usuário logado uma vez e disponibiliza pra sidebar e telas.

## Detalhes técnicos

### Funções SECURITY DEFINER (anti-recursão RLS)

```sql
CREATE FUNCTION current_workspace_id() RETURNS uuid
  -- retorna o workspace_id do membro logado (assume 1 workspace por usuário nesta fase)

CREATE FUNCTION can_view(_module text) RETURNS boolean
CREATE FUNCTION can_edit(_module text) RETURNS boolean
CREATE FUNCTION is_workspace_admin() RETURNS boolean
```

Owner do workspace é sempre admin implícito. Todas as policies passam por essas funções pra evitar recursão e simplificar SQL.

### Modelo de papéis vs permissões

- **`owner`**: lmaciel66 — acesso total, não pode ser removido nem ter permissões reduzidas
- **`admin`**: gerencia usuários e tem acesso total a módulos
- **`member`**: só vê/edita módulos marcados em `module_permissions`

### Cadastro público

`supabase--configure_auth` com `disable_signup: true`. A criação de contas passa a ser exclusivamente pela tela de admin (via `supabaseAdmin.auth.admin.createUser`).

### Migração de dados (uma vez)

```sql
INSERT INTO workspaces (id, name, owner_id)
SELECT gen_random_uuid(), 'RM Financeiro', id FROM auth.users
WHERE email = 'lmaciel66@gmail.com';

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner' FROM workspaces w;

UPDATE clients SET workspace_id = (SELECT id FROM workspaces LIMIT 1);
-- repete para cada tabela
```

## O que NÃO muda nesta fase

- Mantemos `user_roles` (admin global) só pra compatibilidade do is_admin existente — o controle real passa a ser via `workspace_members.role`.
- Continua 1 workspace só (do lmaciel66). A tabela permite múltiplos no futuro, mas a UI assume 1.
- Logs de atividade continuam por `user_id` (quem fez), só ganham `workspace_id` pra filtro.

## Ordem de execução

1. **Migração SQL** (criação de tabelas, funções, backfill, novas RLS) — 1 migration grande, reversível em teoria
2. **Server functions** de admin (criar/editar/remover membro)
3. **Tela de Usuários** reformulada
4. **Hook `useMyPermissions`** + ocultação de itens da sidebar + guards nas rotas
5. **Desabilitar signup público**
6. **Testes manuais**: criar um usuário só com `view` em "Clientes", confirmar que ele só vê clientes e nada mais

## Riscos

- **Migração de dados existentes**: se o email `lmaciel66@gmail.com` não existir no auth, a migration falha. Vou validar isso antes.
- **Quebra temporária**: durante a migration, qualquer usuário logado pode ver tela vazia até o backfill completar. Deve durar segundos.
- **Permissão de módulo pra recursos aninhados** (ex: `order_items` herda permissão de `orders`): vou agrupar via RLS que consulta o pai.

Confirma esse plano pra eu seguir com a implementação?
