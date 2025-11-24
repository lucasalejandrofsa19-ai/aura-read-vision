-- Add ultra_performance_mode column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS ultra_performance_mode BOOLEAN DEFAULT false;