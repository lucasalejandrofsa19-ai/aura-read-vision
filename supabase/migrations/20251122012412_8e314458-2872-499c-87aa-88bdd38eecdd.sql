-- Create user_suggestions table
CREATE TABLE public.user_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own suggestions
CREATE POLICY "Users can create suggestions"
ON public.user_suggestions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own suggestions
CREATE POLICY "Users can view their own suggestions"
ON public.user_suggestions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Admins can view all suggestions
CREATE POLICY "Admins can view all suggestions"
ON public.user_suggestions
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Policy: Admins can update suggestions (status, etc)
CREATE POLICY "Admins can update suggestions"
ON public.user_suggestions
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

-- Policy: Admins can delete suggestions
CREATE POLICY "Admins can delete suggestions"
ON public.user_suggestions
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_user_suggestions_updated_at
BEFORE UPDATE ON public.user_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();