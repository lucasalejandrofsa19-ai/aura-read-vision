-- Add sync_reading_enabled column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN sync_reading_enabled boolean DEFAULT true;