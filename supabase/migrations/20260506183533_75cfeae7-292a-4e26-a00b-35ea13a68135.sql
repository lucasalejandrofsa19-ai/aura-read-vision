
UPDATE storage.buckets SET public = false WHERE id IN ('avatars', 'premium-covers', 'highlight-images');

-- Ensure RLS policies exist for authenticated users to read these buckets
DROP POLICY IF EXISTS "Authenticated can read avatars" ON storage.objects;
CREATE POLICY "Authenticated can read avatars" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated can read highlight-images" ON storage.objects;
CREATE POLICY "Authenticated can read highlight-images" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'highlight-images');

DROP POLICY IF EXISTS "Premium users can read premium-covers" ON storage.objects;
CREATE POLICY "Premium users can read premium-covers" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'premium-covers' AND public.has_premium_access(auth.uid())
);
