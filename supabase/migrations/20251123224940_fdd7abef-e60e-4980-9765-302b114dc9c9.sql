-- Create whitelisted IPs table
CREATE TABLE public.whitelisted_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whitelisted_ips ENABLE ROW LEVEL SECURITY;

-- Admins can view all whitelisted IPs
CREATE POLICY "Admins can view all whitelisted IPs"
ON public.whitelisted_ips
FOR SELECT
USING (is_admin(auth.uid()));

-- Admins can insert whitelisted IPs
CREATE POLICY "Admins can insert whitelisted IPs"
ON public.whitelisted_ips
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Admins can update whitelisted IPs
CREATE POLICY "Admins can update whitelisted IPs"
ON public.whitelisted_ips
FOR UPDATE
USING (is_admin(auth.uid()));

-- Admins can delete whitelisted IPs
CREATE POLICY "Admins can delete whitelisted IPs"
ON public.whitelisted_ips
FOR DELETE
USING (is_admin(auth.uid()));

-- Create function to check if IP is whitelisted
CREATE OR REPLACE FUNCTION public.is_ip_whitelisted(check_ip TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.whitelisted_ips
    WHERE ip_address = check_ip
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Create index for fast IP lookups
CREATE INDEX idx_whitelisted_ips_address ON public.whitelisted_ips(ip_address);
CREATE INDEX idx_whitelisted_ips_expires_at ON public.whitelisted_ips(expires_at) WHERE expires_at IS NOT NULL;