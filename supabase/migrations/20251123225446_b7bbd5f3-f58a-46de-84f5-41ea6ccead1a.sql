-- Add reputation fields to blocked_ips table
ALTER TABLE public.blocked_ips
ADD COLUMN IF NOT EXISTS reputation_score INTEGER,
ADD COLUMN IF NOT EXISTS reputation_data JSONB,
ADD COLUMN IF NOT EXISTS is_threat BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS threat_categories TEXT[];

-- Add reputation fields to premium_access_audit table
ALTER TABLE public.premium_access_audit
ADD COLUMN IF NOT EXISTS reputation_checked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reputation_score INTEGER;

-- Create index for threat queries
CREATE INDEX IF NOT EXISTS idx_blocked_ips_is_threat ON public.blocked_ips(is_threat) WHERE is_threat = true;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_reputation_score ON public.blocked_ips(reputation_score) WHERE reputation_score IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.blocked_ips.reputation_score IS 'AbuseIPDB confidence score (0-100), higher = more malicious';
COMMENT ON COLUMN public.blocked_ips.is_threat IS 'True if IP is flagged as threat by reputation service';
COMMENT ON COLUMN public.blocked_ips.threat_categories IS 'Categories of malicious activity detected';