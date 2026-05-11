
CREATE TABLE public.deepen_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  book_title TEXT,
  topics TEXT[],
  file_path TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deepen_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deepen exports" ON public.deepen_exports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own deepen exports" ON public.deepen_exports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own deepen exports" ON public.deepen_exports
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_deepen_exports_user_created ON public.deepen_exports(user_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public) VALUES ('deepen-exports', 'deepen-exports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own deepen export files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'deepen-exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own deepen export files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deepen-exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own deepen export files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deepen-exports' AND auth.uid()::text = (storage.foldername(name))[1]);
