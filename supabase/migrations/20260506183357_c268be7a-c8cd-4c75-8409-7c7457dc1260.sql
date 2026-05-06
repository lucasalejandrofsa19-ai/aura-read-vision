
-- 1. Fix premium_access_audit INSERT policy (was WITH CHECK true for authenticated)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.premium_access_audit;

CREATE POLICY "Users can insert their own audit logs"
ON public.premium_access_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from anon (keep authenticated where needed for RLS)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_premium_access(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ip_blocked(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ip_whitelisted(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_book_limit(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_ip_whitelisted(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_book_limit(uuid) TO authenticated, service_role;

-- 3. Realtime channel auth: restrict realtime.messages to authenticated users only
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);
