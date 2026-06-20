GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;