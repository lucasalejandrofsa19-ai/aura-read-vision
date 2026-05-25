
-- Remove overly permissive storage SELECT policies
DROP POLICY IF EXISTS "Authenticated can read highlight-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view premium covers" ON storage.objects;

-- Add owner-scoped read policy for highlight-images (files stored as {user_id}/...)
CREATE POLICY "Users can read their own highlight images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'highlight-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Add explicit owner-scoped UPDATE policy for pdfs bucket
CREATE POLICY "Authenticated users can update their own PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pdfs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'pdfs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Fix mutable search_path on compute_level function
CREATE OR REPLACE FUNCTION public.compute_level(xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT GREATEST(1, FLOOR(SQRT(GREATEST(xp,0)::numeric / 50.0))::integer + 1);
$function$;
