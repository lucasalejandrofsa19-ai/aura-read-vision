import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";

interface SubscriptionStatus {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
  role: string | null;
}

const SUB_CACHE_KEY = "subscription_status_cache";
const SUB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const readCache = (userId: string): SubscriptionStatus | null => {
  try {
    const raw = sessionStorage.getItem(`${SUB_CACHE_KEY}_${userId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > SUB_CACHE_TTL) return null;
    return data;
  } catch { return null; }
};

const writeCache = (userId: string, data: SubscriptionStatus) => {
  try {
    sessionStorage.setItem(`${SUB_CACHE_KEY}_${userId}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
};

export const useSubscription = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    product_id: null,
    subscription_end: null,
    role: null,
  });
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setStatus({
        subscribed: false,
        product_id: null,
        subscription_end: null,
        role: null,
      });
      setLoading(false);
      return;
    }

    try {
      setChecking(true);
      
      // Verify session is still valid before making the call
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.warn("Session invalid or expired, skipping subscription check");
        setStatus({
          subscribed: false,
          product_id: null,
          subscription_end: null,
          role: null,
        });
        setLoading(false);
        setChecking(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-subscription");

      if (error) {
        // If error is about authentication, don't show toast
        if (error.message?.includes("session") || error.message?.includes("auth")) {
          console.warn("Authentication error in subscription check:", error);
          setStatus({
            subscribed: false,
            product_id: null,
            subscription_end: null,
            role: null,
          });
        } else {
          throw error;
        }
      } else {
        setStatus(data);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
      // Only show error toast if it's not an auth issue
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes("session") && !errorMessage.includes("auth")) {
        toast.error("Erro ao verificar assinatura");
      }
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, [user]);

  const createCheckout = async (priceId: string) => {
    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Erro ao criar sessão de pagamento");
    }
  };

  const openCustomerPortal = async () => {
    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      captureError(error, { context: "customer_portal" });
      if (import.meta.env.DEV) {
        console.error("Error opening customer portal:", error);
      }
      toast.error("Erro ao abrir portal de gerenciamento");
    }
  };

  useEffect(() => {
    checkSubscription();

    // Check subscription every minute
    const interval = setInterval(checkSubscription, 60000);

    return () => clearInterval(interval);
  }, [checkSubscription]);

  return {
    ...status,
    loading,
    checking,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
};
