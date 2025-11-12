-- Create a security definer function to check book upload limits based on subscription tier
CREATE OR REPLACE FUNCTION public.check_book_limit(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  book_count integer;
  user_tier text;
  max_books integer;
BEGIN
  -- Get the user's subscription tier from profiles
  SELECT subscription_tier INTO user_tier 
  FROM public.profiles 
  WHERE id = user_id;
  
  -- If no profile found, default to free tier
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;
  
  -- Count existing books for this user
  SELECT COUNT(*) INTO book_count 
  FROM public.books 
  WHERE books.user_id = check_book_limit.user_id;
  
  -- Determine max books based on tier
  max_books := CASE user_tier
    WHEN 'premium' THEN 1000
    WHEN 'pro' THEN 100
    ELSE 5  -- free tier
  END;
  
  -- Return true if under limit, false if at or over limit
  RETURN book_count < max_books;
END;
$$;

-- Add RLS policy to enforce book limits on INSERT
CREATE POLICY "Enforce subscription book limits on insert"
ON public.books
FOR INSERT
TO authenticated
WITH CHECK (public.check_book_limit(auth.uid()));