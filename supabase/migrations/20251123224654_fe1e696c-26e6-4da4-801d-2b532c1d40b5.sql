-- Create blocked IPs table
CREATE TABLE public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  blocked_by UUID REFERENCES auth.users(id),
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  auto_blocked BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- Admins can view all blocked IPs
CREATE POLICY "Admins can view all blocked IPs"
ON public.blocked_ips
FOR SELECT
USING (is_admin(auth.uid()));

-- Admins can insert blocked IPs
CREATE POLICY "Admins can insert blocked IPs"
ON public.blocked_ips
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Admins can update blocked IPs
CREATE POLICY "Admins can update blocked IPs"
ON public.blocked_ips
FOR UPDATE
USING (is_admin(auth.uid()));

-- Admins can delete blocked IPs (unblock)
CREATE POLICY "Admins can delete blocked IPs"
ON public.blocked_ips
FOR DELETE
USING (is_admin(auth.uid()));

-- Service role can insert blocked IPs (for auto-blocking)
CREATE POLICY "Service role can insert blocked IPs"
ON public.blocked_ips
FOR INSERT
WITH CHECK (true);

-- Create function to check if IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(check_ip TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blocked_ips
    WHERE ip_address = check_ip
      AND (blocked_until IS NULL OR blocked_until > now())
  );
$$;

-- Create index for fast IP lookups
CREATE INDEX idx_blocked_ips_address ON public.blocked_ips(ip_address);
CREATE INDEX idx_blocked_ips_blocked_until ON public.blocked_ips(blocked_until) WHERE blocked_until IS NOT NULL;