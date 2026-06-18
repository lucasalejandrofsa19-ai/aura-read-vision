
CREATE TABLE IF NOT EXISTS public.email_preferences (
  email TEXT PRIMARY KEY,
  marketing BOOLEAN NOT NULL DEFAULT true,
  product_updates BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_preferences TO service_role;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.email_preferences FOR ALL USING (false) WITH CHECK (false);
