
-- Sócios
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  share_percent numeric NOT NULL DEFAULT 50,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p select" ON public.partners FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "p insert" ON public.partners FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p update" ON public.partners FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "p delete" ON public.partners FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE TRIGGER partners_touch BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Investimentos
CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  position integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv select" ON public.investments FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "inv insert" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inv update" ON public.investments FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "inv delete" ON public.investments FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE TRIGGER investments_touch BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Pagamentos de investimento por sócio
CREATE TABLE public.investment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  UNIQUE (investment_id, partner_id)
);
ALTER TABLE public.investment_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ip select" ON public.investment_payments FOR SELECT USING (EXISTS (SELECT 1 FROM public.investments i WHERE i.id = investment_id AND (i.user_id = auth.uid() OR is_admin(auth.uid()))));
CREATE POLICY "ip insert" ON public.investment_payments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.investments i WHERE i.id = investment_id AND i.user_id = auth.uid()));
CREATE POLICY "ip update" ON public.investment_payments FOR UPDATE USING (EXISTS (SELECT 1 FROM public.investments i WHERE i.id = investment_id AND (i.user_id = auth.uid() OR is_admin(auth.uid()))));
CREATE POLICY "ip delete" ON public.investment_payments FOR DELETE USING (EXISTS (SELECT 1 FROM public.investments i WHERE i.id = investment_id AND (i.user_id = auth.uid() OR is_admin(auth.uid()))));

-- Tarefas / pendências
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  notes text,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "t select" ON public.tasks FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "t insert" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "t update" ON public.tasks FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "t delete" ON public.tasks FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE TRIGGER tasks_touch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
