-- Remove anonymous access from storage policies
-- Drop existing policies that allow anonymous access
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view premium covers" ON storage.objects;

-- Recreate policies restricted to authenticated users only
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can view premium covers"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'premium-covers');

-- Premium users can view premium PDFs - already has proper auth check
-- Other policies are already properly restricted