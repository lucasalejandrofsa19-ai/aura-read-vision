import { motion } from "framer-motion";
import { Smartphone, Zap, WifiOff, Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const PWAPromoBanner = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const benefits = [
    {
      icon: WifiOff,
      title: "Acesso Offline",
      description: "Leia sem internet",
    },
    {
      icon: Zap,
      title: "Super Rápido",
      description: "Performance nativa",
    },
    {
      icon: Bell,
      title: "Notificações",
      description: "Fique sempre atualizado",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 1.2 }}
      className="relative w-full max-w-5xl mx-auto px-4 mt-16"
    >
      <div className="glass rounded-2xl p-6 md:p-8 border-2 border-primary/20 relative overflow-hidden">
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5"
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            backgroundSize: "200% 200%",
          }}
        />

        {/* Close button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted/50 transition-colors z-10"
          aria-label="Fechar banner"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="flex-shrink-0"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
            </motion.div>

            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl md:text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Instale o AURA READ como App
              </h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Tenha a melhor experiência de leitura com todos os benefícios de um app nativo
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 + index * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-background/50 backdrop-blur-sm"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{benefit.title}</p>
                  <p className="text-xs text-muted-foreground">{benefit.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <Button
              onClick={() => navigate("/install")}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity group"
              size="lg"
            >
              Ver Como Instalar
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="ml-2"
              >
                →
              </motion.span>
            </Button>
            <Button
              onClick={() => setIsVisible(false)}
              variant="ghost"
              size="lg"
              className="text-muted-foreground hover:text-foreground"
            >
              Agora Não
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PWAPromoBanner;
