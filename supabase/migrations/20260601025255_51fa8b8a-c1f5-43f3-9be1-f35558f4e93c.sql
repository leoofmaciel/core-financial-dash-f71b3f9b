DO $$
DECLARE
  t text;
  data_tables text[] := ARRAY[
    'clients','categories','orders','order_items','order_materials',
    'order_attachments','order_communications','budgets','budget_items',
    'transactions','recurrences','investments','investment_payments',
    'partners','tasks','message_templates','company_settings',
    'fiscal_documents','fiscal_settings','activity_logs'
  ];
BEGIN
  FOREACH t IN ARRAY data_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET DEFAULT public.current_workspace_id()', t);
  END LOOP;
END $$;