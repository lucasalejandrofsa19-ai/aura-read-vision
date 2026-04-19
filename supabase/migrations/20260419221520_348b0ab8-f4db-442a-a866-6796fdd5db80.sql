-- Make pdfs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'pdfs';

-- Remove permissive INSERT policy on blocked_ips (service role bypasses RLS already)
DROP POLICY IF EXISTS "Service role can insert blocked IPs" ON public.blocked_ips;