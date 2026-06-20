CREATE OR REPLACE FUNCTION public.bump_premium_books_updated_at_on_file_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.file_path IS DISTINCT FROM OLD.file_path THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS premium_books_file_path_bump_updated_at ON public.premium_books;

CREATE TRIGGER premium_books_file_path_bump_updated_at
BEFORE UPDATE ON public.premium_books
FOR EACH ROW
WHEN (OLD.file_path IS DISTINCT FROM NEW.file_path)
EXECUTE FUNCTION public.bump_premium_books_updated_at_on_file_change();