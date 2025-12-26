-- Add TTS provider preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN tts_provider TEXT DEFAULT 'elevenlabs' CHECK (tts_provider IN ('elevenlabs', 'openai'));