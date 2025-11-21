-- Add cover_image_url to premium_books table
ALTER TABLE premium_books 
ADD COLUMN cover_image_url text;

-- Create storage bucket for premium book covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('premium-covers', 'premium-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow premium users to view covers
CREATE POLICY "Premium users can view covers"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'premium-covers' 
  AND has_premium_access(auth.uid())
);

-- Allow admins to upload covers
CREATE POLICY "Admins can upload covers"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'premium-covers' 
  AND is_admin(auth.uid())
);

-- Allow admins to delete covers
CREATE POLICY "Admins can delete covers"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'premium-covers' 
  AND is_admin(auth.uid())
);