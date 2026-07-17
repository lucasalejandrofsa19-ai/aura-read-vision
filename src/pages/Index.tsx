import { useId } from "react";
import { SEO } from "@/components/SEO";
import { lazy, Suspense } from "react";
const FloatingBook3D = lazy(() => import("@/components/FloatingBook3D"));

import { motion } from "framer-motion";
import { Book, Sparkles, ArrowRight, Highlighter, BookmarkCheck, Share2, Wand2, FileDown, Image, Infinity as InfinityIcon, Library, Star, Quote, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import PWAPromoBanner from "@/components/PWAPromoBanner";
import { PremiumBadge } from "@/components/PremiumBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PUBLIC_PDFS_LABEL, PUBLIC_PDFS_TOOLTIP, PUBLIC_PDFS_DESCRIPTION } from "@/lib/publicPdfs";

const Index = () => {
  const navigate = useNavigate();
  const publicPdfsDescId = useId();

  const features = [
    {
      icon: Highlighter,
      title: "Destaques que viram conhecimento",
      description: "Marque trechos com um toque. Vão para sua biblioteca automaticamente, prontos para revisar.",
    },
    {
      icon: BookmarkCheck,
      title: "Tudo o que importa, num só lugar",
      description: "Seus destaques organizados por livro. Reveja em segundos o que levou horas para ler.",
    },
    {
      icon: Share2,
      title: "Compartilhe insights, não arquivos",
      description: "Envie trechos por link ou QR Code. Quem recebe lê e marca sem instalar nada.",
    },
  ];

  const premiumFeatures = [
    {
      icon: Wand2,
      title: "Resumos com IA",
      description: "Transforme dezenas de destaques em um resumo claro e estruturado — em segundos.",
      highlight: "Ilimitado",
    },
    {
      icon: FileDown,
      title: "Exporte para onde trabalha",
      description: "Leve seus destaques para Word, Notion, Markdown e PDF. Formatados, prontos para usar.",
      highlight: "10+ formatos",
    },
    {
      icon: Image,
      title: "Visualize ideias com IA",
      description: "Gere ilustrações dos seus destaques. Conceitos abstratos viram imagens memoráveis.",
      highlight: "Criação ilimitada",
    },
    {
      icon: InfinityIcon,
      title: "Biblioteca sem teto",
      description: "Suba quantos PDFs quiser. Sua coleção cresce com você, sem limites.",
      highlight: "Sem restrições",
    },
    {
      icon: Library,
      title: "Curadoria Premium",
      description: "Acesso a uma biblioteca de obras selecionadas — leituras escolhidas a dedo.",
      highlight: "Catálogo exclusivo",
    },
  ];

  const testimonials = [
    {
      name: "Ana Silva",
      role: "Estudante de Medicina",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ana",
      rating: 5,
      text: "Revolucionou minha forma de estudar! Os resumos com IA me economizam horas de trabalho e consigo revisar todo o conteúdo muito mais rápido.",
    },
    {
      name: "Carlos Mendes",
      role: "Pesquisador",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos",
      rating: 5,
      text: "A exportação para Word facilita muito na hora de escrever artigos. Consigo organizar todas minhas anotações de forma profissional.",
    },
    {
      name: "Juliana Costa",
      role: "Designer",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Juliana",
      rating: 5,
      text: "As imagens geradas por IA são incríveis! Transformo meus insights em visuais inspiradores para compartilhar com minha equipe.",
    },
  ];

  return (
    <>
    <SEO
      title="AURA READ — Leia menos. Retenha mais."
      description="Marque, resuma e domine qualquer PDF com IA. Biblioteca pessoal, destaques inteligentes e resumos automáticos. Comece grátis."
      path="/"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "AURA READ",
        applicationCategory: "EducationApplication",
        operatingSystem: "Web, iOS, Android",
        offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
      }}
    />
    <div className="min-h-screen relative overflow-hidden">
      <Suspense fallback={null}><FloatingBook3D /></Suspense>



      {/* Hero section — desktop-first: 2 colunas em lg+ */}
      <div className="relative z-10 mx-auto w-full max-w-screen-2xl px-6 lg:px-12 xl:px-20 pt-20 lg:pt-28 pb-16">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0 }}
          className="reveal-on-scroll grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center min-h-[70vh]"
        >
          {/* Texto à esquerda */}
          <div className="lg:col-span-7 text-center lg:text-left">
            <motion.div
              className="flex justify-center lg:justify-start mb-6"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="relative">
                <Book className="w-16 h-16 lg:w-20 lg:h-20 text-primary aura-safira" />
                <Sparkles className="w-8 h-8 text-accent absolute -top-2 -right-2" />
              </div>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-bold mb-6 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent leading-tight">
              A biblioteca onde cada leitura vira conhecimento.
            </h1>

            <p className="text-lg lg:text-xl xl:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto lg:mx-0">
              Marque, resuma e domine qualquer PDF com IA. Leia menos. Retenha mais.
            </p>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button
                size="lg"
                onClick={() => navigate("/library")}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-lg px-8 py-6 aura-safira group"
              >
                Começar grátis
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate("/demo")}
                className="text-lg px-8 py-6 group"
              >
                <Sparkles className="mr-2 w-5 h-5" />
                Experimente sem login
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/pricing")}
                className="text-lg px-8 py-6"
              >
                Conhecer o Premium
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => window.open("/pdfs-publicos", "_blank", "noopener,noreferrer")}
                title={PUBLIC_PDFS_TOOLTIP}
                aria-label={PUBLIC_PDFS_TOOLTIP}
                aria-describedby={publicPdfsDescId}
                className="text-lg px-8 py-6"
              >
                {PUBLIC_PDFS_LABEL}
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                <span id={publicPdfsDescId} className="sr-only">{PUBLIC_PDFS_DESCRIPTION}</span>
              </Button>
            </motion.div>
          </div>

          {/* Visual à direita (desktop) — preview decorativo */}
          <div className="hidden lg:flex lg:col-span-5 justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="relative w-full max-w-md aspect-[3/4] glass rounded-3xl overflow-hidden border border-primary/20 aura-safira"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-10">
                <Book className="w-28 h-28 text-primary" />
                <div className="space-y-3 w-full">
                  <div className="h-3 bg-primary/30 rounded-full w-full" />
                  <div className="h-3 bg-primary/20 rounded-full w-5/6" />
                  <div className="h-3 bg-accent/30 rounded-full w-2/3" />
                  <div className="h-3 bg-primary/20 rounded-full w-4/5" />
                </div>
                <div className="flex gap-2 mt-4">
                  <Highlighter className="w-6 h-6 text-accent" />
                  <BookmarkCheck className="w-6 h-6 text-primary" />
                  <Wand2 className="w-6 h-6 text-accent" />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>


        {/* Premium Features Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="reveal-on-scroll mt-24 w-full"
        >
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="inline-flex items-center gap-2 mb-4"
            >
              <PremiumBadge variant="default" />
            </motion.div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent">
              Premium: para quem leva leitura a sério
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto">
              Ferramentas avançadas para estudantes, pesquisadores e leitores ávidos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {premiumFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 + index * 0.1 }}
              >
                <Card className="glass border-amber-500/20 hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-amber-500/10 h-full group">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 group-hover:from-amber-500/30 group-hover:to-orange-500/30 transition-colors">
                        <feature.icon className="w-6 h-6 text-amber-500" />
                      </div>
                      <PremiumBadge variant="icon-only" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      <Sparkles className="w-3 h-3" />
                      {feature.highlight}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0 }}
            className="text-center mt-12"
          >
            <Button
              size="lg"
              onClick={() => navigate("/pricing")}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-6 text-lg gap-2"
            >
              <PremiumBadge variant="icon-only" className="text-white" />
              Começar com o Premium
              <ArrowRight className="w-5 h-5" />
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              A partir de R$ 19,90/mês. Sem fidelidade. Cancele em um clique.
            </p>
          </motion.div>
        </motion.div>

        {/* Features básicas */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.8, duration: 0.6 }}
          className="reveal-on-scroll grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-24 w-full"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.0 + index * 0.1 }}
              className="glass rounded-xl p-8 aura-soft transition-aura hover:aura-safira text-center lg:text-left"
            >
              <feature.icon className="w-12 h-12 text-primary mb-4 mx-auto lg:mx-0" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-base text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

    </div>
    </>
  );
};

export default Index;
