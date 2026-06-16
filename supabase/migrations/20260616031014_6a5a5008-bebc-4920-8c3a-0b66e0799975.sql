
ALTER TABLE public.premium_books ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Premium users can view premium books" ON public.premium_books;
CREATE POLICY "View premium books (premium or free)"
  ON public.premium_books FOR SELECT
  TO authenticated
  USING (is_free = true OR public.has_premium_access(auth.uid()));

GRANT SELECT ON public.premium_books TO anon;
CREATE POLICY "Anon can view free premium books"
  ON public.premium_books FOR SELECT
  TO anon
  USING (is_free = true);

-- Allow any user (incl. anon) to read storage objects in premium-pdfs under free/ prefix
CREATE POLICY "Anyone can view free premium PDFs"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'premium-pdfs' AND (storage.foldername(name))[1] = 'free');
