
-- 1) Avatars bucket: restrict SELECT to owner folder
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read avatars" ON storage.objects;
CREATE POLICY "Users can view their own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2) user_achievements: block client inserts/deletes (server-only via SECURITY DEFINER funcs)
CREATE POLICY "Block client inserts on user_achievements"
ON public.user_achievements FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Block client deletes on user_achievements"
ON public.user_achievements FOR DELETE
TO authenticated
USING (false);

-- 3) Fix mutable search_path on email helper functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
