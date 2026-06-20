import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// Redact PII (emails) before logging. Keep first char + domain only.
const redactEmail = (email?: string | null): string => {
  if (!email || typeof email !== "string") return "<none>";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Map Stripe product IDs to roles
const PRODUCT_ROLE_MAP: Record<string, string> = {
  "prod_TU5KLqyK3KGUSd": "premium", // Premium plan
  "prod_TU5KTScAQUJOkS": "premium", // Pro plan (also gets premium role)
  "prod_UbkPfLxJPAXXI5": "premium", // Estudante plan
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("Authentication failed", { error: userError.message });
      // Return a proper response for auth errors instead of throwing
      return new Response(JSON.stringify({ 
        subscribed: false,
        error: "Session expired or invalid",
        auth_error: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Return 200 instead of 500 for auth errors
      });
    }
    const user = userData.user;
    if (!user?.email) {
      logStep("No user or email found");
      return new Response(JSON.stringify({ 
        subscribed: false,
        error: "User not authenticated",
        auth_error: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    logStep("User authenticated", { userId: user.id, email_redacted: redactEmail(user.email) });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, removing premium roles");
      
      // Remove any premium roles if no customer exists
      await supabaseClient
        .from("user_roles")
        .delete()
        .eq("user_id", user.id)
        .eq("role", "premium");
      
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let role = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      productId = subscription.items.data[0].price.product as string;
      role = PRODUCT_ROLE_MAP[productId] || null;
      logStep("Determined subscription tier", { productId, role });

      // Update user role if they have active subscription
      if (role) {
        const { error: roleError } = await supabaseClient
          .from("user_roles")
          .upsert(
            { user_id: user.id, role },
            { onConflict: "user_id,role" }
          );
        
        if (roleError) {
          logStep("Error updating user role", { error: roleError });
        } else {
          logStep("User role updated successfully", { role });
        }
      }
    } else {
      logStep("No active subscription found, removing premium roles");
      
      // Remove premium role if no active subscription
      await supabaseClient
        .from("user_roles")
        .delete()
        .eq("user_id", user.id)
        .eq("role", "premium");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd,
      role
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
