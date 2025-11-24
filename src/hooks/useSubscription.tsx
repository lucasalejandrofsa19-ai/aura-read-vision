import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SubscriptionStatus {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
  role: string | null;
}

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
      const { data, error } = await supabase.functions.invoke("check-subscription");

      if (error) throw error;

      setStatus(data);
    } catch (error) {
      console.error("Error checking subscription:", error);
      toast.error("Erro ao verificar assinatura");
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
      console.error("Error opening customer portal:", error);
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
