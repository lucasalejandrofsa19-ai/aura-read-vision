import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import { Book, Sparkles, BookOpen, Highlighter, Share2, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import LibraryCTA from "@/components/LibraryCTA";

const Welcome = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const features = [
    {
      icon: BookOpen,
      title: "Biblioteca Pessoal",
      description: "Organize todos os seus PDFs em um só lugar",
      color: "text-primary",
    },
    {
      icon: Highlighter,
      title: "Destaque e Anote",
      description: "Faça anotações e destaque trechos importantes",
      color: "text-accent",
    },
    {
      icon: Share2,
      title: "Compartilhe",
      description: "Compartilhe seus livros e destacados com amigos",
      color: "text-primary",
    },
    {
      icon: FileText,
      title: "Resumos Inteligentes",
      description: "Gere resumos automáticos dos seus livros",
      color: "text-accent",
    },
  ];

  const handleContinue = async () => {
    if (!user) {
      navigate("/library");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ has_seen_welcome: true })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Bem-vindo ao AURA READ!");
      navigate("/library");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao continuar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <SEO
      title="Bem-vindo — AURA READ"
      description="Comece sua jornada de leitura inteligente com a AURA READ."
      path="/welcome"
    />
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="w-full max-w-4xl relative z-10 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          {/* Logo */}
          <motion.div
            className="flex justify-center items-center mb-6"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative">
              <Book className="w-16 h-16 text-primary aura-safira" />
              <Sparkles className="w-6 h-6 text-accent absolute -top-1 -right-1" />
            </div>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Bem-vindo ao AURA READ!
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Sua biblioteca pessoal interativa. Leia, destaque, anote e compartilhe seus livros de forma inteligente.
          </motion.p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            >
              <Card className="glass border-primary/20 h-full hover:border-primary/40 transition-all aura-soft">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10`}>
                      <feature.icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <div className="flex-1">
                      <h2 className="font-semibold text-lg mb-2">{feature.title}</h2>
                      <p className="text-muted-foreground text-sm">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={loading}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity aura-safira text-lg px-8 py-6"
          >
            {loading ? "Carregando..." : "Começar a Ler"}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </div>
    </div>
    </>
  );
};

export default Welcome;
