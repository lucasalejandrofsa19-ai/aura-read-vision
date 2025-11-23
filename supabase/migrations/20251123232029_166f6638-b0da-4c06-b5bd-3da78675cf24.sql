-- Create reading_sessions table to track reading activity
CREATE TABLE public.reading_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  book_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  pages_read INTEGER NOT NULL DEFAULT 0,
  start_page INTEGER NOT NULL,
  end_page INTEGER,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own reading sessions"
ON public.reading_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading sessions"
ON public.reading_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading sessions"
ON public.reading_sessions
FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_reading_sessions_user_id ON public.reading_sessions(user_id);
CREATE INDEX idx_reading_sessions_book_id ON public.reading_sessions(book_id);
CREATE INDEX idx_reading_sessions_started_at ON public.reading_sessions(started_at DESC);