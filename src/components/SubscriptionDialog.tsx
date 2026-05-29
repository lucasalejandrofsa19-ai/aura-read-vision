import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUBSCRIPTION_PLANS = {
  pro: {
    name: "Pro",
    price: "R$ 19,90",
    priceId: "price_1SX79qFGn21ViXD3SRtlkbgi",
    features: [
      "Até 100 PDFs",
      "Todos os recursos básicos",
      "Exportação de anotações (PDF, Word, Markdown)",
      "Modo de apresentação",
      "Busca avançada",
    ],
  },
  estudante: {
    name: "Estudante",
    price: "R$ 29,90",
    priceId: "price_1TcWuoFGn21ViXD3g9dai6D8",
    features: [
      "Até 200 PDFs",
      "Todos os recursos do Pro",
      "Resumos acadêmicos com IA",
      "Aprofundamento de tópicos com IA",
      "Modo focado de estudo",
      "Suporte prioritário para estudantes",
    ],
  },
  premium: {
    name: "Premium",
    price: "R$ 39,90",
    priceId: "price_1SX79rFGn21ViXD3aVs533MV",
    features: [
      "PDFs ilimitados",
      "Todos os recursos Pro",
      "Leitura em voz alta com vozes premium",
      "Modo de leitura focada com temas",
      "Exportação para Notion",
      "Suporte prioritário",
    ],
  },
};

const SubscriptionDialog = ({ open, onOpenChange }: SubscriptionDialogProps) => {
  const { createCheckout, subscribed, product_id, loading } = useSubscription();

  const handleSubscribe = async (priceId: string) => {
    await createCheckout(priceId);
  };

  const isCurrentPlan = (key: string) => {
    if (!subscribed) return false;
    // Map plan keys to product IDs
    const productMap: Record<string, string> = {
      pro: "prod_TU5KTScAQUJOkS",
      estudante: "prod_UbkPfLxJPAXXI5",
      premium: "prod_TU5KLqyK3KGUSd"
    };
    return productMap[key] === product_id;
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
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={loading || isCurrentPlan(key)}
                className="w-full"
                variant={isCurrentPlan(key) ? "outline" : "default"}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrentPlan(key) ? (
                  "Plano Atual"
                ) : (
                  "Assinar"
                )}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionDialog;
