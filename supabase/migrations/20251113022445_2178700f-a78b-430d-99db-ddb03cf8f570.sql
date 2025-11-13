-- Add theme preference to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'safira';

-- Add comment to explain theme options
COMMENT ON COLUMN public.profiles.theme_preference IS 'User theme preference: safira, sepia, noturno, contraste, or custom';