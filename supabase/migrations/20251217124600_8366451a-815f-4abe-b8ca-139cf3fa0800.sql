-- Create table for audiobook progress
CREATE TABLE public.audiobook_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  current_page integer NOT NULL DEFAULT 1,
  playback_position numeric NOT NULL DEFAULT 0,
  playback_rate numeric NOT NULL DEFAULT 1,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);

-- Enable RLS
ALTER TABLE public.audiobook_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own audiobook progress"
ON public.audiobook_progress
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audiobook progress"
ON public.audiobook_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audiobook progress"
ON public.audiobook_progress
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audiobook progress"
ON public.audiobook_progress
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_audiobook_progress_user_book ON public.audiobook_progress(user_id, book_id);