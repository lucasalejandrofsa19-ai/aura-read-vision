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

// Map Stripe product IDs to roles
const PRODUCT_ROLE_MAP: Record<string, string> = {
  "prod_TU5KLqyK3KGUSd": "premium", // Premium plan
  "prod_TU5KTScAQUJOkS": "premium", // Pro plan
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
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get the signature from headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    // Get raw body for signature verification
    const body = await req.text();
    
    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { type: event.type });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Handle different event types
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep(`Processing ${event.type}`, { 
          subscriptionId: subscription.id,
          status: subscription.status,
          customerId: subscription.customer 
        });

        // Get customer email
        const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
        if (!customer.email) {
          logStep("No email found for customer");
          break;
        }

        logStep("Customer found", { email: customer.email });

        // 1.2 fix: lookup user via profiles (indexed) instead of auth.admin.listUsers()
        const { data: profile, error: userError } = await supabaseClient
          .from("profiles")
          .select("id")
          .eq("email", customer.email)
          .maybeSingle();
        if (userError) throw userError;

        const user = profile ? { id: profile.id as string } : null;
        if (!user) {
          logStep("No user found for email", { email: customer.email });
          break;
        }


        logStep("User found", { userId: user.id });

        // Get product ID from subscription
        const productId = subscription.items.data[0]?.price.product as string;
        const role = PRODUCT_ROLE_MAP[productId];

        if (subscription.status === "active" && role) {
          // Add premium role
          const { error: roleError } = await supabaseClient
            .from("user_roles")
            .upsert(
              { user_id: user.id, role },
              { onConflict: "user_id,role" }
            );

          if (roleError) {
            logStep("Error adding role", { error: roleError });
          } else {
            logStep("Premium role added", { userId: user.id, role });
          }
        } else if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
          // Remove premium role
          const { error: roleError } = await supabaseClient
            .from("user_roles")
            .delete()
            .eq("user_id", user.id)
            .eq("role", "premium");

          if (roleError) {
            logStep("Error removing role", { error: roleError });
          } else {
            logStep("Premium role removed", { userId: user.id });
          }
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing subscription deletion", { 
          subscriptionId: subscription.id,
          customerId: subscription.customer 
        });

        // Get customer email
        const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
        if (!customer.email) {
          logStep("No email found for customer");
          break;
        }

        // 1.2 fix: lookup user via profiles instead of auth.admin.listUsers()
        const { data: profile, error: userError } = await supabaseClient
          .from("profiles")
          .select("id")
          .eq("email", customer.email)
          .maybeSingle();
        if (userError) throw userError;

        const user = profile ? { id: profile.id as string } : null;
        if (!user) {
          logStep("No user found for email", { email: customer.email });
          break;
        }


        // Remove premium role
        const { error: roleError } = await supabaseClient
          .from("user_roles")
          .delete()
          .eq("user_id", user.id)
          .eq("role", "premium");

        if (roleError) {
          logStep("Error removing role", { error: roleError });
        } else {
          logStep("Premium role removed on deletion", { userId: user.id });
        }

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment succeeded", { 
          invoiceId: invoice.id,
          customerId: invoice.customer,
          subscriptionId: invoice.subscription 
        });
        // Payment succeeded - subscription should already be active
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { 
          invoiceId: invoice.id,
          customerId: invoice.customer,
          subscriptionId: invoice.subscription 
        });
        // Payment failed - Stripe will handle retries
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
