
CREATE TABLE public.book_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX book_shares_token_idx ON public.book_shares(token);
CREATE INDEX book_shares_book_id_idx ON public.book_shares(book_id);

GRANT SELECT, INSERT, DELETE ON public.book_shares TO authenticated;
GRANT ALL ON public.book_shares TO service_role;

ALTER TABLE public.book_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their book shares"
  ON public.book_shares FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Owners can create shares for their books"
  ON public.book_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.books b
      WHERE b.id = book_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete their book shares"
  ON public.book_shares FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
