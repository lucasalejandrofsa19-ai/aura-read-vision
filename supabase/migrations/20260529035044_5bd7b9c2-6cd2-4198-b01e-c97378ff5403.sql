
-- 1. Storage UPDATE policies for premium buckets (admin only)
CREATE POLICY "Admins can update premium covers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'premium-covers' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'premium-covers' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update premium pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'premium-pdfs' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'premium-pdfs' AND public.is_admin(auth.uid()));

-- 2. Scope realtime subscriptions by user topic
DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;
CREATE POLICY "Users can subscribe to own realtime topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE '%:' || auth.uid()::text
  OR realtime.topic() = auth.uid()::text
);

-- 3. Remove client-side INSERT on user_achievements (handled by SECURITY DEFINER check_achievements)
DROP POLICY IF EXISTS "Users insert own achievements" ON public.user_achievements;
