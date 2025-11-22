-- Add page turn sound preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS page_turn_sound_enabled BOOLEAN DEFAULT true;