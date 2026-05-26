
-- Clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  company text,
  cnpj text,
  email text,
  phone text,
  address text,
  contact_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cli select" ON public.clients FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "cli insert" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cli update" ON public.clients FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "cli delete" ON public.clients FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Order status enum
CREATE TYPE public.order_status AS ENUM ('rascunho','orcamento','aprovado','cancelado');

-- Orders
CREATE SEQUENCE public.order_number_seq START 1;
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  number integer NOT NULL DEFAULT nextval('public.order_number_seq'),
  status public.order_status NOT NULL DEFAULT 'rascunho',
  total numeric NOT NULL DEFAULT 0,
  delivery_time text,
  payment_terms text,
  notes text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ord select" ON public.orders FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "ord insert" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ord update" ON public.orders FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "ord delete" ON public.orders FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Order items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oi select" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR is_admin(auth.uid()))));
CREATE POLICY "oi insert" ON public.order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));
CREATE POLICY "oi update" ON public.order_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR is_admin(auth.uid()))));
CREATE POLICY "oi delete" ON public.order_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR is_admin(auth.uid()))));

-- Order materials (turn into accounts payable)
CREATE TABLE public.order_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  supplier_name text,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  due_date date,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "om select" ON public.order_materials FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_materials.order_id AND (o.user_id = auth.uid() OR is_admin(auth.uid()))));
CREATE POLICY "om insert" ON public.order_materials FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_materials.order_id AND o.user_id = auth.uid()));
CREATE POLICY "om update" ON public.order_materials FOR UPDATE USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_materials.order_id AND (o.user_id = auth.uid() OR is_admin(auth.uid()))));
CREATE POLICY "om delete" ON public.order_materials FOR DELETE USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_materials.order_id AND (o.user_id = auth.uid() OR is_admin(auth.uid()))));

-- Linking columns
ALTER TABLE public.budgets ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
