ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS cover_status text NOT NULL DEFAULT 'pending'
  CHECK (cover_status IN ('pending', 'ready', 'failed'));

-- Backfill: livros que já têm capa = ready
UPDATE public.books SET cover_status = 'ready' WHERE cover_image_url IS NOT NULL AND cover_status <> 'ready';