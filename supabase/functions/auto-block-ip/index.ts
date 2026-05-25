import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Threshold configuration
const AUTO_BLOCK_THRESHOLDS = {
  RATE_LIMIT_VIOLATIONS: 10, // Block after 10 rate limit violations
  HIGH_VOLUME_ATTEMPTS: 50,   // Block after 50 attempts from same IP
  FAILED_ATTEMPTS: 20,        // Block after 20 failed premium access attempts
};

const BLOCK_DURATION_HOURS = 24; // Block for 24 hours

interface BlockCheckRequest {
  ipAddress: string;
  userId?: string;
  reason: 'rate_limit' | 'high_volume' | 'failed_attempts';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    // Require authentication: internal shared secret or admin user JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const internalSecret = Deno.env.get('INTERNAL_ALERT_SECRET');
    const providedToken = authHeader.replace('Bearer ', '').trim();
    let authorized = false;

    if (internalSecret && providedToken && providedToken === internalSecret) {
      authorized = true;
    } else if (providedToken) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(providedToken);
      if (!authError && user) {
        const { data: roles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin');
        if (roles && roles.length > 0) authorized = true;
      }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { ipAddress, userId, reason }: BlockCheckRequest = await req.json();
    
    
    console.log(`[AUTO-BLOCK] Checking IP: ${ipAddress} for reason: ${reason}`);

    // Check reputation before blocking (forward internal secret)
    const reputationCheck = await supabaseClient.functions.invoke('check-ip-reputation', {
      body: { ipAddress, maxAgeInDays: 90 },
      headers: internalSecret ? { Authorization: `Bearer ${internalSecret}` } : {},
    });

    let reputationScore: number | undefined;
    let isThreat = false;
    let threatCategories: string[] = [];

    if (reputationCheck.data?.success) {
      const reputation = reputationCheck.data.reputation;
      reputationScore = reputation.abuseConfidenceScore;
      isThreat = reputation.isThreat;
      threatCategories = reputation.threatCategories || [];
      
      console.log(`[AUTO-BLOCK] IP ${ipAddress} reputation score: ${reputationScore}, threat: ${isThreat}`);
    } else {
      console.warn(`[AUTO-BLOCK] Could not check reputation for ${ipAddress}:`, reputationCheck.error);
    }

    // Check if IP is whitelisted
    const { data: isWhitelisted } = await supabaseClient.rpc('is_ip_whitelisted', { 
      check_ip: ipAddress 
    });

    if (isWhitelisted) {
      console.log(`[AUTO-BLOCK] IP ${ipAddress} is whitelisted, skipping auto-block`);
      return new Response(
        JSON.stringify({ 
          blocked: false, 
          whitelisted: true,
          reputation: reputationCheck.data?.reputation,
          message: 'IP is whitelisted and exempt from auto-blocking'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Check if IP is already blocked
    const { data: existingBlock } = await supabaseClient
      .from('blocked_ips')
      .select('*')
      .eq('ip_address', ipAddress)
      .maybeSingle();

    if (existingBlock) {
      console.log(`[AUTO-BLOCK] IP ${ipAddress} is already blocked`);
      return new Response(
        JSON.stringify({ blocked: true, existing: true }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Query audit logs to check thresholds
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentLogs, error: logsError } = await supabaseClient
      .from('premium_access_audit')
      .select('*')
      .eq('ip_address', ipAddress)
      .gte('created_at', oneHourAgo);

    if (logsError) throw logsError;

    const rateLimitViolations = recentLogs?.filter(
      log => log.reason === 'rate_limit_exceeded'
    ).length || 0;

    const failedAttempts = recentLogs?.filter(
      log => !log.granted && log.reason !== 'rate_limit_exceeded'
    ).length || 0;

    const totalAttempts = recentLogs?.length || 0;

    console.log(`[AUTO-BLOCK] IP ${ipAddress} stats:`, {
      rateLimitViolations,
      failedAttempts,
      totalAttempts,
    });

    // Determine if IP should be blocked
    let shouldBlock = false;
    let blockReason = '';
    let metadata: Record<string, any> = {};

    if (reason === 'rate_limit' && rateLimitViolations >= AUTO_BLOCK_THRESHOLDS.RATE_LIMIT_VIOLATIONS) {
      shouldBlock = true;
      blockReason = `Automatic block: ${rateLimitViolations} rate limit violations in the last hour`;
      metadata = { rateLimitViolations, threshold: AUTO_BLOCK_THRESHOLDS.RATE_LIMIT_VIOLATIONS };
    } else if (reason === 'high_volume' && totalAttempts >= AUTO_BLOCK_THRESHOLDS.HIGH_VOLUME_ATTEMPTS) {
      shouldBlock = true;
      blockReason = `Automatic block: ${totalAttempts} attempts in the last hour`;
      metadata = { totalAttempts, threshold: AUTO_BLOCK_THRESHOLDS.HIGH_VOLUME_ATTEMPTS };
    } else if (reason === 'failed_attempts' && failedAttempts >= AUTO_BLOCK_THRESHOLDS.FAILED_ATTEMPTS) {
      shouldBlock = true;
      blockReason = `Automatic block: ${failedAttempts} failed attempts in the last hour`;
      metadata = { failedAttempts, threshold: AUTO_BLOCK_THRESHOLDS.FAILED_ATTEMPTS };
    }

    if (shouldBlock) {
      const blockedUntil = new Date(Date.now() + BLOCK_DURATION_HOURS * 60 * 60 * 1000);
      
      const { error: blockError } = await supabaseClient
        .from('blocked_ips')
        .insert({
          ip_address: ipAddress,
          reason: blockReason,
          blocked_until: blockedUntil.toISOString(),
          auto_blocked: true,
          reputation_score: reputationScore,
          is_threat: isThreat,
          threat_categories: threatCategories.length > 0 ? threatCategories : null,
          metadata: {
            ...metadata,
            userId,
            detectionReason: reason,
            blockedUntil: blockedUntil.toISOString(),
            reputationData: reputationCheck.data?.reputation,
          },
        });

      if (blockError) throw blockError;

      console.log(`[AUTO-BLOCK] IP ${ipAddress} has been blocked until ${blockedUntil.toISOString()}`);

      // Send security alert
      await supabaseClient.functions.invoke('send-security-alert', {
        body: {
          alert: {
            type: 'suspicious_pattern',
            ipAddress,
            userId,
            details: {
              reason: blockReason,
              blockedUntil: blockedUntil.toISOString(),
              ...metadata,
            },
          },
        },
        headers: internalSecret ? { Authorization: `Bearer ${internalSecret}` } : {},
      }).catch(err => console.error('[AUTO-BLOCK] Alert error:', err));

      return new Response(
        JSON.stringify({ 
          blocked: true, 
          reason: blockReason,
          blockedUntil: blockedUntil.toISOString(),
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        blocked: false,
        stats: { rateLimitViolations, failedAttempts, totalAttempts },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[AUTO-BLOCK] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
