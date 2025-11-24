import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      throw new Error("Missing stripe-signature header");
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { type: event.type });
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { sessionId: session.id });

        if (session.mode === "subscription" && session.customer) {
          const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
          
          // Get customer email
          const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          if (customer.deleted) {
            logStep("Customer was deleted", { customerId });
            break;
          }

          const email = customer.email;
          if (!email) {
            logStep("No email found for customer", { customerId });
            break;
          }

          // Find user by email
          const { data: userData, error: userError } = await supabaseClient.auth.admin.listUsers();
          if (userError) {
            logStep("Error listing users", { error: userError });
            break;
          }

          const user = userData.users.find(u => u.email === email);
          if (!user) {
            logStep("User not found for email", { email });
            break;
          }

          // Add premium role if not exists
          const { error: roleError } = await supabaseClient
            .from("user_roles")
            .upsert({ user_id: user.id, role: "premium" }, { onConflict: "user_id,role" });

          if (roleError) {
            logStep("Error adding premium role", { error: roleError, userId: user.id });
          } else {
            logStep("Premium role added", { userId: user.id, email });
          }

          // Update profile with Stripe customer ID
          await supabaseClient
            .from("profiles")
            .update({ 
              stripe_customer_id: customerId,
              subscription_status: "active",
              subscription_tier: "premium"
            })
            .eq("id", user.id);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        
        logStep(`Subscription ${event.type === "customer.subscription.created" ? "created" : "updated"}`, {
          subscriptionId: subscription.id,
          status: subscription.status,
          customerId
        });

        // Get customer email
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        if (customer.deleted) {
          logStep("Customer was deleted", { customerId });
          break;
        }

        const email = customer.email;
        if (!email) {
          logStep("No email found for customer", { customerId });
          break;
        }

        // Find user by email
        const { data: userData, error: userError } = await supabaseClient.auth.admin.listUsers();
        if (userError) {
          logStep("Error listing users", { error: userError });
          break;
        }

        const user = userData.users.find(u => u.email === email);
        if (!user) {
          logStep("User not found for email", { email });
          break;
        }

        // Handle subscription status
        if (subscription.status === "active" || subscription.status === "trialing") {
          // Add premium role
          const { error: roleError } = await supabaseClient
            .from("user_roles")
            .upsert({ user_id: user.id, role: "premium" }, { onConflict: "user_id,role" });

          if (roleError) {
            logStep("Error adding premium role", { error: roleError, userId: user.id });
          } else {
            logStep("Premium role added/confirmed", { userId: user.id, email, status: subscription.status });
          }

          // Update profile
          await supabaseClient
            .from("profiles")
            .update({ 
              stripe_customer_id: customerId,
              subscription_status: subscription.status,
              subscription_tier: "premium"
            })
            .eq("id", user.id);

        } else if (subscription.status === "canceled" || subscription.status === "unpaid" || subscription.status === "past_due") {
          // Remove premium role
          const { error: roleError } = await supabaseClient
            .from("user_roles")
            .delete()
            .eq("user_id", user.id)
            .eq("role", "premium");

          if (roleError) {
            logStep("Error removing premium role", { error: roleError, userId: user.id });
          } else {
            logStep("Premium role removed", { userId: user.id, email, status: subscription.status });
          }

          // Update profile
          await supabaseClient
            .from("profiles")
            .update({ 
              subscription_status: subscription.status,
              subscription_tier: "free"
            })
            .eq("id", user.id);
        }

        // Update or create subscription record
        await supabaseClient
          .from("subscriptions")
          .upsert({
            user_id: user.id,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0]?.price.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          }, { onConflict: "stripe_subscription_id" });

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        
        logStep("Subscription deleted", { subscriptionId: subscription.id, customerId });

        // Get customer email
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        if (customer.deleted) {
          logStep("Customer was deleted", { customerId });
          break;
        }

        const email = customer.email;
        if (!email) {
          logStep("No email found for customer", { customerId });
          break;
        }

        // Find user by email
        const { data: userData, error: userError } = await supabaseClient.auth.admin.listUsers();
        if (userError) {
          logStep("Error listing users", { error: userError });
          break;
        }

        const user = userData.users.find(u => u.email === email);
        if (!user) {
          logStep("User not found for email", { email });
          break;
        }

        // Remove premium role
        const { error: roleError } = await supabaseClient
          .from("user_roles")
          .delete()
          .eq("user_id", user.id)
          .eq("role", "premium");

        if (roleError) {
          logStep("Error removing premium role", { error: roleError, userId: user.id });
        } else {
          logStep("Premium role removed", { userId: user.id, email });
        }

        // Update profile
        await supabaseClient
          .from("profiles")
          .update({ 
            subscription_status: "canceled",
            subscription_tier: "free"
          })
          .eq("id", user.id);

        // Update subscription record
        await supabaseClient
          .from("subscriptions")
          .update({
            status: "canceled",
          })
          .eq("stripe_subscription_id", subscription.id);

        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
