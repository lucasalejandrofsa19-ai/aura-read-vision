-- Create storage bucket for cached audiobook audio chunks
INSERT INTO storage.buckets (id, name, public)
VALUES ('audiobook-cache', 'audiobook-cache', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can read their own cached audio
CREATE POLICY "Users can read their own cached audio"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audiobook-cache'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can upload their own cached audio
CREATE POLICY "Users can upload their own cached audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audiobook-cache'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own cached audio
CREATE POLICY "Users can delete their own cached audio"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audiobook-cache'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);