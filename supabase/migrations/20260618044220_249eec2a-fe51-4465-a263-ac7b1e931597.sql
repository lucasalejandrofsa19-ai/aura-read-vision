
ALTER TABLE public.email_preferences
  ADD COLUMN IF NOT EXISTS ads BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS content BOOLEAN NOT NULL DEFAULT true;

-- Backfill new columns from legacy `marketing` flag for existing rows
UPDATE public.email_preferences
   SET ads = marketing,
       content = marketing
 WHERE updated_at < now();
