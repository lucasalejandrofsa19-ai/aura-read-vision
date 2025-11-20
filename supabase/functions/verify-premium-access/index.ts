import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`[VERIFY-PREMIUM] Checking access for user: ${user.id}`);

    // Check if user is admin or has premium role
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('[VERIFY-PREMIUM] Error fetching roles:', rolesError);
      throw rolesError;
    }

    const userRoles = (roles || []).map(r => r.role);
    const hasPremiumAccess = userRoles.includes('admin') || userRoles.includes('premium');

    console.log(`[VERIFY-PREMIUM] User roles: ${userRoles.join(', ')}, has premium: ${hasPremiumAccess}`);

    return new Response(
      JSON.stringify({ 
        hasPremiumAccess,
        roles: userRoles 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
