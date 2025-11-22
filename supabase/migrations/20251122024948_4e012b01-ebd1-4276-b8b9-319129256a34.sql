-- Add cover_image_url column to books table if it doesn't exist
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_image_url TEXT;