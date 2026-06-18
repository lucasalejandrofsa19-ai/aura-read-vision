import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTourTargets } from "@/contexts/TourTargetsContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useQueryClient } from "@tanstack/react-query";

interface TourStep {
  target: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
}

const STORAGE_KEY = "aura_reader_tour_seen";

const tourSteps: TourStep[] = [
  {
    target: "reader-highlight",
    title: "Marca-texto ✍️",
    description: "Ative o marca-texto e arraste sobre trechos do PDF para destacar e copiar o texto automaticamente.",
    placement: "bottom",
  },
  {
    target: "reader-ai-summary",
    title: "Resumo com IA ✨",
    description: "Gere um resumo inteligente do livro inteiro ou apenas dos seus destaques. (Recurso premium)",
    placement: "bottom",
  },
  {
    target: "reader-share",
    title: "Compartilhar 🔗",
    description: "Compartilhe destaques e o livro com outras pessoas via link.",
    placement: "bottom",
  },
];

export const ReaderTour = () => {
  const { getTarget } = useTourTargets();
  const { user } = useAuth();
  const { profile, isLoading } = useUserData();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    if (!user || isLoading) return;
    let cancelled = false;
    if (!profile?.has_seen_reader_tour) {
      const t = setTimeout(() => !cancelled && setShowTour(true), 1200);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
  }, [user, isLoading, profile?.has_seen_reader_tour]);

  useEffect(() => {
    const onRestart = () => {
      setCurrentStep(0);
      setShowTour(true);
    };
    window.addEventListener("reader-tour:restart", onRestart);
    return () => window.removeEventListener("reader-tour:restart", onRestart);
  }, []);

  const update = () => {
    const step = tourSteps[currentStep];
    const el = getTarget(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  };

  useEffect(() => {
    if (!showTour) return;
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTour, currentStep]);

  const finish = async () => {
    setShowTour(false);
    if (user) {
      await supabase
        .from("profiles")
        .update({ has_seen_reader_tour: true })
        .eq("id", user.id);
    }
  };

  const next = () => (currentStep < tourSteps.length - 1 ? setCurrentStep((s) => s + 1) : finish());
  const prev = () => currentStep > 0 && setCurrentStep((s) => s - 1);

  if (!showTour) return null;
  const step = tourSteps[currentStep];

  const tooltipStyle = (() => {
    const offset = 16;
    switch (step.placement) {
      case "top":
        return { top: pos.top - offset, left: pos.left + pos.width / 2, transform: "translate(-50%,-100%)" };
      case "bottom":
        return { top: pos.top + pos.height + offset, left: pos.left + pos.width / 2, transform: "translateX(-50%)" };
      case "left":
        return { top: pos.top + pos.height / 2, left: pos.left - offset, transform: "translate(-100%,-50%)" };
      case "right":
        return { top: pos.top + pos.height / 2, left: pos.left + pos.width + offset, transform: "translateY(-50%)" };
    }
  })();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={finish}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed z-[9999] pointer-events-none"
        style={{
          top: pos.top - 4,
          left: pos.left - 4,
          width: pos.width + 8,
          height: pos.height + 8,
          border: "3px solid hsl(var(--primary))",
          borderRadius: "0.5rem",
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed z-[10000]"
        style={tooltipStyle}
      >
        <Card className="w-80 max-w-[90vw] glass border-primary/20 aura-soft">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1" onClick={finish} aria-label="Fechar tour">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                {currentStep + 1} de {tourSteps.length}
              </div>
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button variant="ghost" size="sm" onClick={prev}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Voltar
                  </Button>
                )}
                <Button size="sm" onClick={next} className="bg-gradient-to-r from-primary to-accent">
                  {currentStep === tourSteps.length - 1 ? "Finalizar" : "Próximo"}
                  {currentStep < tourSteps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};
