-- Update the pdfs bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'pdfs';