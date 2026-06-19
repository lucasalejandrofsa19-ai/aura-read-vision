
-- 1. Fix avatar update policy: add WITH CHECK
DROP POLICY IF EXISTS "Authenticated users can update their own avatar" ON storage.objects;
CREATE POLICY "Authenticated users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Add UPDATE policy on highlights
CREATE POLICY "Users can update their own highlights"
ON public.highlights FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Remove client INSERT policy on premium_access_audit (inserts go through service_role)
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.premium_access_audit;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.premium_access_audit;
DROP POLICY IF EXISTS "Users insert their own audit logs" ON public.premium_access_audit;
