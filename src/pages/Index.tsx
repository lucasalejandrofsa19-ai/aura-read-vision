import { motion } from "framer-motion";
import { Book, Sparkles, ArrowRight, Highlighter, BookmarkCheck, Share2, Wand2, FileDown, Image, Infinity as InfinityIcon, Library, Star, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import PWAPromoBanner from "@/components/PWAPromoBanner";
import { PremiumBadge } from "@/components/PremiumBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Highlighter,
      title: "Marca-texto Inteligente",
      description: "Destaque trechos importantes com um toque. Tudo salvo automaticamente.",
    },
    {
      icon: BookmarkCheck,
      title: "Resumos Automáticos",
      description: "Visualize todas suas marcações organizadas em um só lugar.",
    },
    {
      icon: Share2,
      title: "Compartilhe Facilmente",
      description: "Envie livros e trechos via QR Code ou link direto.",
    },
  ];

  const premiumFeatures = [
    {
      icon: Wand2,
      title: "Resumos com IA",
      description: "Gere resumos inteligentes dos seus destaques usando inteligência artificial avançada.",
      highlight: "Ilimitado",
    },
    {
      icon: FileDown,
      title: "Exportação Avançada",
      description: "Exporte seus destaques para Word, Notion e mais formatos profissionais.",
      highlight: "10+ formatos",
    },
    {
      icon: Image,
      title: "Imagens com IA",
      description: "Transforme seus destaques em ilustrações visuais usando geração de imagens com IA.",
      highlight: "Criação ilimitada",
    },
    {
      icon: InfinityIcon,
      title: "Uploads Ilimitados",
      description: "Adicione quantos livros quiser à sua biblioteca sem restrições.",
      highlight: "Sem limites",
    },
    {
      icon: Library,
      title: "Livros Premium",
      description: "Acesso exclusivo à coleção de livros premium selecionados especialmente.",
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl"
          animate={{
            scale: [1.3, 1, 1.3],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Hero section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Logo */}
          <motion.div
            className="flex justify-center mb-6"
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="relative">
              <Book className="w-20 h-20 text-primary aura-safira" />
              <Sparkles className="w-8 h-8 text-accent absolute -top-2 -right-2" />
            </div>
          </motion.div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent px-4">
            AURA READ
          </h1>
          
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl px-4">
            Sua biblioteca pessoal interativa com leitura futurista e inteligente
          </p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              size="lg"
              onClick={() => navigate("/library")}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-lg px-8 py-6 aura-safira group"
            >
              Começar Agora
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </motion.div>

        {/* PWA Promo Banner */}
        <PWAPromoBanner />

        {/* Premium Features Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-16 max-w-6xl px-4 w-full"
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent">
              Recursos Premium
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Desbloqueie o potencial completo da sua leitura com recursos exclusivos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
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
              Ver Planos Premium
              <ArrowRight className="w-5 h-5" />
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              A partir de R$ 19,90/mês • Cancele quando quiser
            </p>
          </motion.div>
        </motion.div>

        {/* Testimonials Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 0.6 }}
          className="mt-24 max-w-6xl px-4 w-full"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              O que dizem nossos usuários <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Premium</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Milhares de leitores já transformaram sua experiência de leitura
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.4 + index * 0.1 }}
              >
                <Card className="glass border-border/50 hover:border-amber-500/30 transition-all h-full group">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12 border-2 border-amber-500/20">
                          <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                          <AvatarFallback>{testimonial.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground">{testimonial.name}</h3>
                          <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                        </div>
                      </div>
                      <PremiumBadge variant="icon-only" />
                    </div>
                    <div className="flex gap-1 mb-3">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <Quote className="absolute -top-2 -left-2 w-8 h-8 text-amber-500/20" />
                      <p className="text-sm text-muted-foreground pl-6 italic">
                        "{testimonial.text}"
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.8, duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-24 max-w-5xl px-4 w-full"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.0 + index * 0.1 }}
              className="glass rounded-xl p-6 aura-soft transition-aura hover:aura-safira"
            >
              <feature.icon className="w-10 h-10 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
