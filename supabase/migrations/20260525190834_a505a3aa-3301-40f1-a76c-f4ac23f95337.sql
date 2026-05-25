CREATE TABLE public.recurrences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type tx_type NOT NULL,
  amount NUMERIC NOT NULL,
  category_id UUID,
  payment_method TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  day_of_month INTEGER,
  day_of_week INTEGER,
  next_run DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rec select" ON public.recurrences FOR SELECT USING ((auth.uid() = user_id) OR is_admin(auth.uid()));
CREATE POLICY "rec insert" ON public.recurrences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rec update" ON public.recurrences FOR UPDATE USING ((auth.uid() = user_id) OR is_admin(auth.uid()));
CREATE POLICY "rec delete" ON public.recurrences FOR DELETE USING ((auth.uid() = user_id) OR is_admin(auth.uid()));

CREATE TRIGGER trg_recurrences_updated BEFORE UPDATE ON public.recurrences
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_recurrences_user ON public.recurrences(user_id);
CREATE INDEX idx_recurrences_next_run ON public.recurrences(next_run) WHERE active = true;