import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Sparkles, Zap, Crown, GraduationCap, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useEffect } from "react";
import { toast } from "sonner";

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
    priceId: "price_1SX79qFGn21ViXD3SRtlkbgi",
    icon: Zap,
    color: "from-blue-500 to-blue-700",
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
  estudante: {
    name: "Estudante",
    price: "R$ 29,90",
    period: "/mês",
    priceId: "price_1TcWuoFGn21ViXD3g9dai6D8",
    icon: GraduationCap,
    color: "from-emerald-500 to-teal-700",
    popular: true,
    features: [
      "Até 200 PDFs",
      "Todos os recursos do plano Pro",
      "Resumos acadêmicos com IA",
      "Aprofundamento de tópicos com IA",
      "Geração de imagens dos destaques (limitada)",
      "Modo focado de estudo",
      "Estatísticas avançadas para estudos",
      "Suporte prioritário para estudantes",
    ],
  },
  premium: {
    name: "Premium",
    price: "R$ 39,90",
    period: "/mês",
    priceId: "price_1SX79rFGn21ViXD3aVs533MV",
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
  const [searchParams] = useSearchParams();
  const { createCheckout, openCustomerPortal, subscribed, product_id, loading, checkSubscription } = useSubscription();

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success) {
      toast.success("Assinatura realizada com sucesso!");
      checkSubscription();
      window.history.replaceState({}, "", "/pricing");
    } else if (canceled) {
      toast.error("Assinatura cancelada");
      window.history.replaceState({}, "", "/pricing");
    }
  }, [searchParams, checkSubscription]);

  const handleSubscribe = async (priceId: string) => {
    await createCheckout(priceId);
  };

  const isCurrentPlan = (key: string) => {
    if (!subscribed) return key === "free";
    const productMap: Record<string, string> = {
      pro: "prod_TU5KTScAQUJOkS",
      estudante: "prod_UbkPfLxJPAXXI5",
      premium: "prod_TU5KLqyK3KGUSd"
    };
    return productMap[key] === product_id;
  };

  const productJsonLd = Object.entries(PLANS).map(([key, plan]) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: `AURA READ ${plan.name}`,
    description: plan.features.slice(0, 3).join(", "),
    offers: {
      "@type": "Offer",
      price: plan.price.replace(/[^\d,]/g, "").replace(",", "."),
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
    },
  }));

  return (
    <>
    <SEO
      title="Planos e Preços — AURA READ"
      description="Compare os planos Gratuito, Pro e Premium. Recursos exclusivos como TTS, exportação, IA de imagens e biblioteca premium."
      path="/pricing"
      jsonLd={productJsonLd}
    />
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

        <div className="grid md:grid-cols-3 gap-8 max-w-screen-2xl mx-auto px-4 lg:px-12">
          {Object.entries(PLANS).map(([key, plan], index) => {
            const Icon = plan.icon;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className={`relative h-full ${
                    plan.popular ? "border-blue-500 shadow-lg shadow-blue-500/20" : ""
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500">
                      Mais Popular
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
                    {key !== "free" && plan.priceId && (
                      <Button
                        onClick={() => handleSubscribe(plan.priceId!)}
                        disabled={loading || isCurrentPlan(key)}
                        className="w-full"
                        variant={isCurrentPlan(key) ? "outline" : "default"}
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isCurrentPlan(key) ? (
                          "Plano Atual"
                        ) : (
                          "Assinar Agora"
                        )}
                      </Button>
                    )}
                    {key === "free" && (
                      <div className="w-full text-center text-sm text-muted-foreground">
                        Plano Gratuito
                      </div>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {subscribed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-12"
          >
            <Button
              onClick={openCustomerPortal}
              variant="outline"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Gerenciar Assinatura
            </Button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center text-muted-foreground"
        >
          <p>Pagamentos processados de forma segura pelo Stripe</p>
        </motion.div>
      </div>
    </div>
    </>
  );
}
