
CREATE TABLE IF NOT EXISTS public.story_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  book_id uuid,
  book_title text,
  mode text,
  scenes_count integer DEFAULT 0,
  file_path text,
  file_size bigint,
  file_mime text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS story_videos_user_created_idx ON public.story_videos(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_videos TO authenticated;
GRANT ALL ON public.story_videos TO service_role;

ALTER TABLE public.story_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own story videos" ON public.story_videos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own story videos" ON public.story_videos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own story videos" ON public.story_videos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own story videos" ON public.story_videos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.can_generate_story_video(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_premium boolean;
  v_used integer;
  v_limit integer := 1;
BEGIN
  v_premium := public.has_premium_access(_user_id);
  SELECT COUNT(*) INTO v_used FROM public.story_videos
    WHERE user_id = _user_id
      AND created_at >= date_trunc('month', now());
  IF v_premium THEN
    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', -1, 'premium', true);
  END IF;
  RETURN jsonb_build_object(
    'allowed', v_used < v_limit,
    'used', v_used,
    'limit', v_limit,
    'premium', false
  );
END;
$$;

-- Storage policies for the private bucket story-videos
CREATE POLICY "Users read own story video files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'story-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own story video files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'story-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own story video files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'story-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own story video files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'story-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
