
-- WAVE 1.3 support
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_key_window
  ON public.rate_limit_buckets (bucket_key, window_start DESC);
GRANT ALL ON public.rate_limit_buckets TO service_role;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role manages rate buckets" ON public.rate_limit_buckets;
CREATE POLICY "service role manages rate buckets"
  ON public.rate_limit_buckets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- WAVE 3 GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_sessions    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audiobook_progress  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_stats  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_progress      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deepen_exports      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlight_images    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_suggestions    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlights          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_videos        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_shares         TO authenticated;
GRANT SELECT ON public.achievements      TO authenticated;
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT SELECT ON public.user_roles        TO authenticated;
GRANT SELECT ON public.premium_books     TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- WAVE 2 REVOKEs (mantemos legítimas: register_pages_read, award_action_xp, set_daily_goal, can_generate_story_video)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer)    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid)                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_level(integer)                      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at()                         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_admin_role()                         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_ip_blocked(text)                         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_ip_whitelisted(text)                     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)                              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_premium_access(uuid)                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_book_limit(uuid)                      FROM anon, authenticated;
