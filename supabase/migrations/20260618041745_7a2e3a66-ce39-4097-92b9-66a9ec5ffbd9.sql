CREATE INDEX IF NOT EXISTS idx_books_user_id_created_at ON public.books (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON public.highlights (user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes (user_id);