
-- ============================================================
-- Wave 1: Security hardening — restrict SECURITY DEFINER funcs
-- ============================================================
-- Strategy: REVOKE EXECUTE from PUBLIC/anon on every SECURITY
-- DEFINER function, then GRANT back only to the roles that
-- legitimately need to call it (authenticated for user RPCs,
-- service_role for backend-only helpers). RLS helpers stay
-- callable by anon+authenticated because RLS engine runs as the
-- caller and needs to evaluate them.

-- ---------- User-callable RPCs (authenticated only) ----------
REVOKE ALL ON FUNCTION public.register_pages_read(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_pages_read(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.award_action_xp(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_action_xp(text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_daily_goal(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_daily_goal(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.can_generate_story_video(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_generate_story_video(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_book_limit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_book_limit(uuid) TO authenticated, service_role;

-- ---------- Internal helpers (service_role only) -------------
REVOKE ALL ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_achievements(uuid) TO service_role;

-- ---------- Email queue (service_role only) ------------------
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;

REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- ---------- Trigger-only functions (no API callers) ----------
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_admin_role() FROM PUBLIC, anon, authenticated;
-- Postgres still executes them via triggers regardless of EXECUTE grants.

-- ---------- RLS helpers (must stay callable) -----------------
-- These are invoked from RLS policies and must remain executable
-- by both anon (for public-readable tables) and authenticated.
-- Explicitly re-grant to be clear about intent:
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)       TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid)       TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(text)            TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_ip_whitelisted(text)        TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_level(integer)         TO anon, authenticated, service_role;
