CREATE OR REPLACE FUNCTION public.get_cron_token(_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT token FROM private.cron_tokens WHERE name = _name LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_token(text) TO service_role;