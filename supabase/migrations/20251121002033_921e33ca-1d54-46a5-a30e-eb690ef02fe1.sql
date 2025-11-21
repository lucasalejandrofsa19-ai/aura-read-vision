-- Create storage bucket for highlight images
INSERT INTO storage.buckets (id, name, public)
VALUES ('highlight-images', 'highlight-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create highlight_images table
CREATE TABLE IF NOT EXISTS public.highlight_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  style TEXT NOT NULL,
  prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.highlight_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for highlight_images
CREATE POLICY "Users can view their own highlight images"
  ON public.highlight_images
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own highlight images"
  ON public.highlight_images
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlight images"
  ON public.highlight_images
  FOR DELETE
  USING (auth.uid() = user_id);

-- Storage policies for highlight-images bucket
CREATE POLICY "Users can view their own highlight images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'highlight-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload their own highlight images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'highlight-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own highlight images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'highlight-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create index for faster queries
CREATE INDEX idx_highlight_images_highlight_id ON public.highlight_images(highlight_id);
CREATE INDEX idx_highlight_images_user_id ON public.highlight_images(user_id);