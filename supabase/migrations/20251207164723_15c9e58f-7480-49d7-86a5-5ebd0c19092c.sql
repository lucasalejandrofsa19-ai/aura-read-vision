-- Add highlight_sensitivity field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS highlight_sensitivity numeric DEFAULT 20;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.highlight_sensitivity IS 'Minimum pixel size for highlight selection (10-50, default 20)';