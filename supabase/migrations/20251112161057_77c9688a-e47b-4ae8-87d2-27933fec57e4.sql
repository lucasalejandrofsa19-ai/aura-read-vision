-- Add summary column to books table for AI-generated summaries
ALTER TABLE public.books 
ADD COLUMN summary text;

-- Add comment to document the column
COMMENT ON COLUMN public.books.summary IS 'AI-generated summary of the book content';