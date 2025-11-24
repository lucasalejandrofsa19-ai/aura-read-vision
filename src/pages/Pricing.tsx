import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Sparkles, Zap, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";

interface PlanFeatures {
  name: string;
  price: string;
  period: string;
  priceId?: string;
  icon: React.ComponentType<any>;
  color: string;
  popular?: boolean;
  features: string[];
  limitations?: string[];
}

const PLANS: Record<string, PlanFeatures> = {
  free: {
    name: "Gratuito",
    price: "R$ 0",
    period: "para sempre",
    icon: Sparkles,
    color: "from-slate-500 to-slate-700",
    features: [
      "Até 5 PDFs",
      "Leitura básica de PDFs",
      "Destaques e anotações",
      "Marcadores de páginas",
      "Sincronização entre dispositivos",
      "Temas básicos de leitura",
    ],
    limitations: [
      "Sem biblioteca premium",
      "Sem exportação de anotações",
      "Sem leitura em voz alta",
      "Sem modo focado avançado",
      "Sem geração de imagens com IA",
      "Sem modo de apresentação",
    ],
  },
  pro: {
    name: "Pro",
    price: "R$ 19,90",
    period: "/mês",
    priceId: "price_1SSeWJFGn21ViXD31bV8SnrT",
    icon: Zap,
    color: "from-blue-500 to-blue-700",
    popular: true,
    features: [
      "Até 100 PDFs",
      "Todos os recursos do plano gratuito",
      "Exportação de anotações (PDF, Word, Markdown)",
      "Modo de apresentação profissional",
      "Busca avançada no texto do PDF",
      "Estatísticas detalhadas de leitura",
      "Compartilhamento de destaques",
      "Controles de navegação avançados",
      "Suporte por email",
    ],
  },
  premium: {
    name: "Premium",
    price: "R$ 39,90",
    period: "/mês",
    priceId: "price_1SSeZkFGn21ViXD3ajyV2R0i",
    icon: Crown,
    color: "from-purple-500 to-purple-700",
    features: [
      "PDFs ilimitados",
      "Todos os recursos do plano Pro",
      "Biblioteca Premium - Livros exclusivos",
      "Leitura em voz alta (Text-to-Speech)",
      "Vozes premium em português e outros idiomas",
      "Modo de leitura focada com temas personalizados",
      "Geração de imagens com IA dos destaques",
      "Galeria de imagens geradas",
      "Exportação para Notion",
      "Controle de velocidade de leitura TTS",
      "Navegação por gestos avançada",
      "Temas visuais exclusivos",
      "Suporte prioritário via chat",
      "Acesso antecipado a novos recursos",
      "Backup automático em nuvem",
    ],
  },
};

export default function Pricing() {
  const navigate = useNavigate();
  const { user, subscriptionTier } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string, planName: string) => {
    if (!user) {
      toast.error("Faça login para assinar");
      navigate("/auth");
      return;
    }

    setLoadingPlan(planName);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      captureError(error, { context: "create-checkout", priceId, planName });
      toast.error("Erro ao processar assinatura. Tente novamente.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const getPlanButton = (planKey: string) => {
    const plan = PLANS[planKey as keyof typeof PLANS];
    
    if (planKey === "free") {
      return (
        <Button variant="outline" disabled className="w-full">
          Plano Atual
        </Button>
      );
    }

    const isCurrentPlan = 
      (subscriptionTier === "pro" && planKey === "pro") ||
      (subscriptionTier === "premium" && planKey === "premium");

    if (isCurrentPlan) {
      return (
        <Button variant="outline" disabled className="w-full">
          <Check className="mr-2 h-4 w-4" />
          Plano Atual
        </Button>
      );
    }

    return (
      <Button
        className="w-full"
        onClick={() => handleSubscribe(plan.priceId!, plan.name)}
        disabled={loadingPlan === plan.name}
      >
        {loadingPlan === plan.name ? "Processando..." : "Assinar Agora"}
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Escolha seu Plano
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Desbloqueie todo o potencial da sua leitura com recursos premium
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {Object.entries(PLANS).map(([key, plan], index) => {
            const Icon = plan.icon;
            const isCurrentPlan = 
              (subscriptionTier === "free" && key === "free") ||
              (subscriptionTier === "pro" && key === "pro") ||
              (subscriptionTier === "premium" && key === "premium");

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className={`relative h-full ${
                    isCurrentPlan ? "border-primary shadow-lg shadow-primary/20" : ""
                  } ${plan.popular ? "border-blue-500 shadow-lg shadow-blue-500/20" : ""}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500">
                      Mais Popular
                    </Badge>
                  )}
                  {isCurrentPlan && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                      Seu Plano
                    </Badge>
                  )}
                  
                  <CardHeader className="text-center pb-8">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription className="text-3xl font-bold text-foreground mt-4">
                      {plan.price}
                      <span className="text-sm font-normal text-muted-foreground">
                        {plan.period}
                      </span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                      {plan.limitations?.map((limitation, i) => (
                        <div key={i} className="flex items-start gap-3 opacity-50">
                          <span className="text-sm line-through">{limitation}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-6">
                    {getPlanButton(key)}
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center text-muted-foreground"
        >
          <p className="mb-2">Todas as assinaturas podem ser canceladas a qualquer momento.</p>
          <p>Pagamento 100% seguro processado pelo Stripe.</p>
        </motion.div>
      </div>
    </div>
  );
}
