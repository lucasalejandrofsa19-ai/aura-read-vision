import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUBSCRIPTION_PLANS = {
  pro: {
    name: "Pro",
    price: "R$ 19,90",
    priceId: "price_pro_monthly",
    features: [
      "Até 100 PDFs",
      "Marca-texto ilimitado",
      "Resumos automáticos",
      "Compartilhamento",
      "Sem anúncios",
    ],
  },
  premium: {
    name: "Premium",
    price: "R$ 39,90",
    priceId: "price_premium_monthly",
    features: [
      "PDFs ilimitados",
      "Marca-texto ilimitado",
      "Resumos com IA",
      "Compartilhamento ilimitado",
      "Prioridade no suporte",
      "Recursos exclusivos",
    ],
  },
};

const SubscriptionDialog = ({ open, onOpenChange }: SubscriptionDialogProps) => {
  const [loading, setLoading] = useState<string | null>(null);
  const { session } = useAuth();

  const handleSubscribe = async (priceId: string, planName: string) => {
    if (!session) {
      toast.error("Faça login para assinar");
      return;
    }

    setLoading(planName);

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error("Erro ao iniciar assinatura");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Escolha seu Plano
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
            <div
              key={key}
              className="glass rounded-xl p-6 border border-primary/20 hover:border-primary/40 transition-all aura-soft"
            >
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {plan.price}
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(plan.priceId, plan.name)}
                disabled={loading !== null}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
              >
                {loading === plan.name ? "Processando..." : "Assinar Agora"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionDialog;
