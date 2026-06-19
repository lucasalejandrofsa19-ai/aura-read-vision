
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.cron_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.cron_tokens TO service_role;

-- Fix linter: revoke from PUBLIC too (anon/authenticated alone left PUBLIC executable).
REVOKE EXECUTE ON FUNCTION public.claim_next_story_video_job() FROM PUBLIC;
