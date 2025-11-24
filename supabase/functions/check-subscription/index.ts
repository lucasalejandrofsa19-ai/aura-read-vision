import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header - returning free tier");
      return new Response(
        JSON.stringify({ subscribed: false, tier: "free" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      console.log("User authentication failed:", userError?.message);
      return new Response(
        JSON.stringify({ subscribed: false, tier: "free" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    const user = userData.user;
    console.log("Checking subscription for user:", { userId: user.id, email: user.email });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      console.log("No Stripe customer found - returning free tier");
      
      // Update profile with free tier
      await supabaseClient
        .from("profiles")
        .update({
          subscription_status: null,
          subscription_tier: "free",
        })
        .eq("id", user.id);
      
      return new Response(
        JSON.stringify({ subscribed: false, tier: "free" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;
    console.log("Found Stripe customer:", customerId);
    
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let tier = "free";
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const priceId = subscription.items.data[0].price.id;
      
      console.log("Active subscription found:", {
        subscriptionId: subscription.id,
        priceId,
        endDate: subscriptionEnd
      });
      
      // Determine tier based on price ID
      // Pro tier: price_1SSeWJFGn21ViXD31bV8SnrT
      // Premium tier: price_1SSeZkFGn21ViXD3ajyV2R0i
      if (priceId === "price_1SSeWJFGn21ViXD31bV8SnrT") {
        tier = "pro";
      } else if (priceId === "price_1SSeZkFGn21ViXD3ajyV2R0i") {
        tier = "premium";
      }

      console.log("Determined tier:", tier);

      // Update profile
      await supabaseClient
        .from("profiles")
        .update({
          subscription_status: "active",
          subscription_tier: tier,
          stripe_customer_id: customerId,
        })
        .eq("id", user.id);
    } else {
      console.log("No active subscription found - updating to free tier");
      
      // Update profile with free tier
      await supabaseClient
        .from("profiles")
        .update({
          subscription_status: null,
          subscription_tier: "free",
        })
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({
        subscribed: hasActiveSub,
        tier,
        subscription_end: subscriptionEnd,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Check subscription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
