import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check } from "lucide-react";

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUBSCRIPTION_PLANS = {
  pro: {
    name: "Pro",
    price: "R$ 19,90",
    priceId: "price_1SSeWJFGn21ViXD31bV8SnrT",
    features: [
      "Até 100 PDFs",
      "Todos os recursos básicos",
      "Exportação de anotações (PDF, Word, Markdown)",
      "Modo de apresentação",
      "Busca avançada",
    ],
  },
  premium: {
    name: "Premium",
    price: "R$ 39,90",
    priceId: "price_1SSeZkFGn21ViXD3ajyV2R0i",
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

              <div className="text-center text-sm text-muted-foreground">
                Em breve: Sistema de pagamento
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionDialog;
