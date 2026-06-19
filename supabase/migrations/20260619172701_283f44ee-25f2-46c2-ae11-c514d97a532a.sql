
CREATE TABLE IF NOT EXISTS public.story_video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  params jsonb NOT NULL,
  result jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_story_video_jobs_status_created
  ON public.story_video_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_story_video_jobs_user_created
  ON public.story_video_jobs (user_id, created_at DESC);

GRANT SELECT ON public.story_video_jobs TO authenticated;
GRANT ALL ON public.story_video_jobs TO service_role;

ALTER TABLE public.story_video_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users view own video jobs" ON public.story_video_jobs;
CREATE POLICY "users view own video jobs"
  ON public.story_video_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service role manages video jobs" ON public.story_video_jobs;
CREATE POLICY "service role manages video jobs"
  ON public.story_video_jobs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_story_video_jobs_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_story_video_jobs_updated_at ON public.story_video_jobs;
CREATE TRIGGER trg_story_video_jobs_updated_at
  BEFORE UPDATE ON public.story_video_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_story_video_jobs_updated_at();

-- Atomic claim: locks the oldest pending row, marks processing, returns it.
CREATE OR REPLACE FUNCTION public.claim_next_story_video_job()
RETURNS public.story_video_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.story_video_jobs;
BEGIN
  SELECT * INTO r FROM public.story_video_jobs
  WHERE status = 'pending' AND attempts < 3
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF r.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.story_video_jobs
    SET status = 'processing',
        attempts = attempts + 1,
        updated_at = now()
    WHERE id = r.id
    RETURNING * INTO r;

  RETURN r;
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_next_story_video_job() FROM anon, authenticated;
