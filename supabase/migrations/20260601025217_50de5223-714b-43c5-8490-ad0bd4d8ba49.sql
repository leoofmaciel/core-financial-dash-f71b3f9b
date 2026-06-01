-- ============ 1. ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.module_key AS ENUM (
    'dashboard','clients','orders','budgets','transactions','categories',
    'recurrences','investments','partners','tasks','fiscal','reports',
    'settings','users'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 2. NEW TABLES ============
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx ON public.workspace_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  module public.module_key NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  UNIQUE(member_id, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_permissions TO authenticated;
GRANT ALL ON public.module_permissions TO service_role;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- ============ 3. HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view(_module public.module_key)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    LEFT JOIN public.module_permissions p
      ON p.member_id = m.id AND p.module = _module
    WHERE m.user_id = auth.uid()
      AND (m.role IN ('owner','admin') OR COALESCE(p.can_view, false))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit(_module public.module_key)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    LEFT JOIN public.module_permissions p
      ON p.member_id = m.id AND p.module = _module
    WHERE m.user_id = auth.uid()
      AND (m.role IN ('owner','admin') OR COALESCE(p.can_edit, false))
  )
$$;

-- ============ 4. SEED OWNER WORKSPACE ============
INSERT INTO public.workspaces (name, owner_id)
SELECT 'RM Financeiro', '06375dfe-c12a-40c4-8705-ebfbb3c680c9'::uuid
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces);

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'::public.workspace_role
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members m
  WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
);

-- ============ 5. RLS ON NEW TABLES ============
CREATE POLICY "ws select" ON public.workspaces FOR SELECT
  USING (id = public.current_workspace_id());
CREATE POLICY "ws update" ON public.workspaces FOR UPDATE
  USING (id = public.current_workspace_id() AND public.is_workspace_admin())
  WITH CHECK (id = public.current_workspace_id() AND public.is_workspace_admin());

CREATE POLICY "wsm select" ON public.workspace_members FOR SELECT
  USING (workspace_id = public.current_workspace_id());
CREATE POLICY "wsm insert" ON public.workspace_members FOR INSERT
  WITH CHECK (workspace_id = public.current_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "wsm update" ON public.workspace_members FOR UPDATE
  USING (workspace_id = public.current_workspace_id() AND public.is_workspace_admin())
  WITH CHECK (workspace_id = public.current_workspace_id() AND public.is_workspace_admin());
CREATE POLICY "wsm delete" ON public.workspace_members FOR DELETE
  USING (workspace_id = public.current_workspace_id() AND public.is_workspace_admin() AND role <> 'owner');

CREATE POLICY "mp select" ON public.module_permissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.id = module_permissions.member_id AND m.workspace_id = public.current_workspace_id()));
CREATE POLICY "mp manage" ON public.module_permissions FOR ALL
  USING (public.is_workspace_admin() AND EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.id = module_permissions.member_id AND m.workspace_id = public.current_workspace_id()))
  WITH CHECK (public.is_workspace_admin() AND EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.id = module_permissions.member_id AND m.workspace_id = public.current_workspace_id()));

-- ============ 6. ADD workspace_id TO ALL DATA TABLES & BACKFILL ============
DO $$
DECLARE
  ws uuid;
  t text;
  data_tables text[] := ARRAY[
    'clients','categories','orders','order_items','order_materials',
    'order_attachments','order_communications','budgets','budget_items',
    'transactions','recurrences','investments','investment_payments',
    'partners','tasks','message_templates','company_settings',
    'fiscal_documents','fiscal_settings','activity_logs'
  ];
BEGIN
  SELECT id INTO ws FROM public.workspaces LIMIT 1;
  FOREACH t IN ARRAY data_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET workspace_id = $1 WHERE workspace_id IS NULL', t) USING ws;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(workspace_id)', t || '_workspace_id_idx', t);
  END LOOP;
END $$;

-- ============ 7. DROP OLD POLICIES ON DATA TABLES ============
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'clients','categories','orders','order_items','order_materials',
        'order_attachments','order_communications','budgets','budget_items',
        'transactions','recurrences','investments','investment_payments',
        'partners','tasks','message_templates','company_settings',
        'fiscal_documents','fiscal_settings','activity_logs'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============ 8. NEW WORKSPACE-SCOPED POLICIES ============
DO $$
DECLARE spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('clients','clients'),
      ('categories','categories'),
      ('orders','orders'),
      ('order_items','orders'),
      ('order_materials','orders'),
      ('order_attachments','orders'),
      ('order_communications','orders'),
      ('budgets','budgets'),
      ('budget_items','budgets'),
      ('transactions','transactions'),
      ('recurrences','recurrences'),
      ('investments','investments'),
      ('investment_payments','investments'),
      ('partners','partners'),
      ('tasks','tasks'),
      ('message_templates','settings'),
      ('company_settings','settings'),
      ('fiscal_documents','fiscal'),
      ('fiscal_settings','fiscal')
    ) AS t(tbl, module)
  LOOP
    EXECUTE format('CREATE POLICY "ws select" ON public.%I FOR SELECT USING (workspace_id = public.current_workspace_id() AND public.can_view(%L::public.module_key))', spec.tbl, spec.module);
    EXECUTE format('CREATE POLICY "ws insert" ON public.%I FOR INSERT WITH CHECK (workspace_id = public.current_workspace_id() AND public.can_edit(%L::public.module_key))', spec.tbl, spec.module);
    EXECUTE format('CREATE POLICY "ws update" ON public.%I FOR UPDATE USING (workspace_id = public.current_workspace_id() AND public.can_edit(%L::public.module_key)) WITH CHECK (workspace_id = public.current_workspace_id() AND public.can_edit(%L::public.module_key))', spec.tbl, spec.module, spec.module);
    EXECUTE format('CREATE POLICY "ws delete" ON public.%I FOR DELETE USING (workspace_id = public.current_workspace_id() AND public.can_edit(%L::public.module_key))', spec.tbl, spec.module);
  END LOOP;
END $$;

-- activity_logs (no UPDATE/DELETE policy = blocked)
CREATE POLICY "logs select" ON public.activity_logs FOR SELECT
  USING (workspace_id = public.current_workspace_id());
CREATE POLICY "logs insert" ON public.activity_logs FOR INSERT
  WITH CHECK (workspace_id = public.current_workspace_id() AND user_id = auth.uid());

-- ============ 9. PROFILES: visible to workspace members ============
DROP POLICY IF EXISTS "Read own or admin" ON public.profiles;
CREATE POLICY "profiles read members" ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (SELECT user_id FROM public.workspace_members WHERE workspace_id = public.current_workspace_id())
    OR is_admin(auth.uid())
  );