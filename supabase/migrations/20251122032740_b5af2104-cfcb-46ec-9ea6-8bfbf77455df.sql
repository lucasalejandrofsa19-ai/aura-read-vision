-- Add sound preferences for different actions to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS highlight_sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS note_sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS bookmark_sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS delete_sound_enabled BOOLEAN DEFAULT true;