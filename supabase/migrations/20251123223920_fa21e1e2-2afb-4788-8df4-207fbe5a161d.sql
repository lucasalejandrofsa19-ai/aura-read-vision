-- Create audit log table for premium feature access
CREATE TABLE IF NOT EXISTS public.premium_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  feature TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  granted BOOLEAN NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_premium_audit_user_id ON public.premium_access_audit(user_id);
CREATE INDEX idx_premium_audit_created_at ON public.premium_access_audit(created_at DESC);
CREATE INDEX idx_premium_audit_feature ON public.premium_access_audit(feature);
CREATE INDEX idx_premium_audit_granted ON public.premium_access_audit(granted);

-- Enable RLS
ALTER TABLE public.premium_access_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.premium_access_audit
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
ON public.premium_access_audit
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only system/service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
ON public.premium_access_audit
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE public.premium_access_audit IS 'Audit log for all premium feature access attempts';
COMMENT ON COLUMN public.premium_access_audit.action IS 'Action attempted: validate, access, export, etc';
COMMENT ON COLUMN public.premium_access_audit.feature IS 'Feature accessed: text-to-speech, export-word, export-notion, etc';
COMMENT ON COLUMN public.premium_access_audit.granted IS 'Whether access was granted';
COMMENT ON COLUMN public.premium_access_audit.reason IS 'Reason for denial if not granted';
COMMENT ON COLUMN public.premium_access_audit.metadata IS 'Additional context (rate limit info, etc)';