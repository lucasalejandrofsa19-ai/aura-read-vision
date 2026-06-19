
CREATE POLICY "Users can upload covers of their own books"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'premium-covers'
  AND EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.user_id = auth.uid()
      AND (
        storage.objects.name = b.id::text || '-cover.jpg'
        OR storage.objects.name = b.id::text || '-cover.png'
        OR storage.objects.name = b.id::text || '-cover.webp'
      )
  )
);

CREATE POLICY "Users can update covers of their own books"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'premium-covers'
  AND EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.user_id = auth.uid()
      AND (
        storage.objects.name = b.id::text || '-cover.jpg'
        OR storage.objects.name = b.id::text || '-cover.png'
        OR storage.objects.name = b.id::text || '-cover.webp'
      )
  )
);

DROP POLICY IF EXISTS "Users can read covers of their own books" ON storage.objects;
CREATE POLICY "Users can read covers of their own books"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'premium-covers'
  AND EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.user_id = auth.uid()
      AND (
        storage.objects.name = b.id::text || '-cover.jpg'
        OR storage.objects.name = b.id::text || '-cover.png'
        OR storage.objects.name = b.id::text || '-cover.webp'
      )
  )
);
