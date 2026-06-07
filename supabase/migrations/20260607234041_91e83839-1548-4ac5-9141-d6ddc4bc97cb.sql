
ALTER TABLE public.story_videos
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS error_message text;
