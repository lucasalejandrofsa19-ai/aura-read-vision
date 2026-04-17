-- Make premium-pdfs bucket private to enforce RLS on direct URL access
UPDATE storage.buckets
SET public = false
WHERE id = 'premium-pdfs';