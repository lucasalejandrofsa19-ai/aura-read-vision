-- Drop ALL existing storage policies to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- Avatars bucket policies (public read, authenticated write/delete)
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- PDFs bucket policies (authenticated only)
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pdfs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can view their own PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pdfs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pdfs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Premium PDFs bucket policies (premium users only)
CREATE POLICY "Admins can upload premium PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'premium-pdfs' 
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Premium users can view premium PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'premium-pdfs' 
  AND public.has_premium_access(auth.uid())
);

CREATE POLICY "Admins can delete premium PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'premium-pdfs' 
  AND public.is_admin(auth.uid())
);

-- Premium covers bucket policies (public read, admin write)
CREATE POLICY "Admins can upload premium covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'premium-covers' 
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Anyone can view premium covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'premium-covers');

CREATE POLICY "Admins can delete premium covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'premium-covers' 
  AND public.is_admin(auth.uid())
);

-- Highlight images bucket policies (authenticated only)
CREATE POLICY "Authenticated users can upload highlight images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'highlight-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can view their own highlight images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'highlight-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can delete their own highlight images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'highlight-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);