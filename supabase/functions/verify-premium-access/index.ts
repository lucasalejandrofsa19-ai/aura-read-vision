import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT_MAX = 20; // requests
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in ms
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  // Clean up expired entries
  if (userLimit && now > userLimit.resetAt) {
    rateLimitMap.delete(userId);
  }

  if (!rateLimitMap.has(userId)) {
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  const limit = rateLimitMap.get(userId)!;

  if (limit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  limit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - limit.count };
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Extract IP and user agent for audit logging
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    console.log(`[VERIFY-PREMIUM] Checking access for user: ${user.id}`);

    // Check if IP is whitelisted (skip blocking check if whitelisted)
    const { data: isWhitelisted } = await supabaseClient.rpc('is_ip_whitelisted', { 
      check_ip: ipAddress 
    });

    if (!isWhitelisted) {
      // Check if IP is blocked only if not whitelisted
      const { data: isBlocked } = await supabaseClient.rpc('is_ip_blocked', { 
        check_ip: ipAddress 
      });

      if (isBlocked) {
        console.warn(`[VERIFY-PREMIUM] Blocked IP attempt: ${ipAddress}`);
        
        // Audit log: Blocked IP attempt
        await supabaseClient.from('premium_access_audit').insert({
          user_id: user.id,
          action: 'validate',
          feature: 'premium_access_check',
          ip_address: ipAddress,
          user_agent: userAgent,
          granted: false,
          reason: 'ip_blocked',
          metadata: { ip_address: ipAddress },
        });

        return new Response(
          JSON.stringify({ 
            error: 'Access denied. Your IP address has been blocked.',
            hasPremiumAccess: false 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403 
          }
        );
      }
    } else {
      console.log(`[VERIFY-PREMIUM] IP ${ipAddress} is whitelisted, bypassing block check`);
    }

    // Apply rate limiting
    const rateLimit = checkRateLimit(user.id);
    
    if (!rateLimit.allowed) {
      console.warn(`[VERIFY-PREMIUM] Rate limit exceeded for user: ${user.id}`);
      
      // Audit log: Rate limit exceeded
      await supabaseClient.from('premium_access_audit').insert({
        user_id: user.id,
        action: 'validate',
        feature: 'premium_access_check',
        ip_address: ipAddress,
        user_agent: userAgent,
        granted: false,
        reason: 'rate_limit_exceeded',
        metadata: {
          rate_limit_max: RATE_LIMIT_MAX,
          rate_limit_window: RATE_LIMIT_WINDOW,
          attempts: rateLimitMap.get(user.id)?.count,
        },
      });

      // Send security alert
      supabaseClient.functions.invoke('send-security-alert', {
        body: {
          alert: {
            type: 'rate_limit_violation',
            userId: user.id,
            ipAddress,
            details: {
              attempts: rateLimitMap.get(user.id)?.count,
              maxAllowed: RATE_LIMIT_MAX,
              window: `${RATE_LIMIT_WINDOW / 1000}s`,
              userAgent,
            },
          },
        },
      }).catch(err => console.error('[VERIFY-PREMIUM] Alert error:', err));

      // Check if IP should be auto-blocked
      supabaseClient.functions.invoke('auto-block-ip', {
        body: {
          ipAddress,
          userId: user.id,
          reason: 'rate_limit',
        },
      }).catch(err => console.error('[VERIFY-PREMIUM] Auto-block error:', err));

      return new Response(
        JSON.stringify({ 
          error: 'Too many requests. Please try again later.',
          hasPremiumAccess: false 
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitMap.get(user.id)!.resetAt.toString(),
          },
          status: 429 
        }
      );
    }

    // Check if user is admin or has premium role
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('[VERIFY-PREMIUM] Error fetching roles:', rolesError);
      
      // Audit log: Error fetching roles
      await supabaseClient.from('premium_access_audit').insert({
        user_id: user.id,
        action: 'validate',
        feature: 'premium_access_check',
        ip_address: ipAddress,
        user_agent: userAgent,
        granted: false,
        reason: 'database_error',
        metadata: { error: rolesError.message },
      });

      throw rolesError;
    }

    const userRoles = (roles || []).map(r => r.role);
    const hasPremiumAccess = userRoles.includes('admin') || userRoles.includes('premium');

    console.log(`[VERIFY-PREMIUM] User roles: ${userRoles.join(', ')}, has premium: ${hasPremiumAccess}`);

    // Audit log: Successful validation
    await supabaseClient.from('premium_access_audit').insert({
      user_id: user.id,
      action: 'validate',
      feature: 'premium_access_check',
      ip_address: ipAddress,
      user_agent: userAgent,
      granted: hasPremiumAccess,
      reason: hasPremiumAccess ? 'has_premium_role' : 'no_premium_role',
      metadata: {
        roles: userRoles,
        rate_limit_remaining: rateLimit.remaining,
      },
    });

    return new Response(
      JSON.stringify({ 
        hasPremiumAccess,
        roles: userRoles 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[VERIFY-PREMIUM] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isUnauthorized = errorMessage === 'Unauthorized';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        hasPremiumAccess: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: isUnauthorized ? 401 : 500 
      }
    );
  }
});
