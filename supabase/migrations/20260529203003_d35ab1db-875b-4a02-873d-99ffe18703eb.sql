CREATE POLICY "Users can read covers of their own books"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'premium-covers'
  AND EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.user_id = auth.uid()
      AND storage.objects.name = b.id::text || '-cover.png'
  )
);