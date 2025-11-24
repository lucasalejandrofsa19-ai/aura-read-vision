-- Add zoom sensitivity preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN zoom_sensitivity numeric DEFAULT 1.0;