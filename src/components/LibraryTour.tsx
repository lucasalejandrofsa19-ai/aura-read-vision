import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useTourTargets } from "@/contexts/TourTargetsContext";

interface TourStep {
  target: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
}

const tourSteps: TourStep[] = [
  {
    target: "upload-button",
    title: "Adicionar Livros 📤",
    description: "Clique aqui para fazer upload dos seus PDFs e adicionar à sua biblioteca.",
    placement: "left",
  },
  {
    target: "search-bar",
    title: "Buscar na Biblioteca 🔍",
    description: "Use a barra de pesquisa para encontrar livros por título ou autor rapidamente.",
    placement: "bottom",
  },
  {
    target: "book-card",
    title: "Seus Livros 📖",
    description: "Clique em qualquer livro para começar a ler. Durante a leitura, você pode destacar texto, fazer anotações, navegar entre páginas e compartilhar destaques.",
    placement: "top",
  },
  {
    target: "profile-button",
    title: "Seu Perfil 👤",
    description: "Acesse suas configurações, veja seus destaques e gerencie sua conta.",
    placement: "bottom",
  },
];

export const LibraryTour = () => {
  const { user } = useAuth();
  const { getTarget } = useTourTargets();
  const [currentStep, setCurrentStep] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [targetPosition, setTargetPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    const checkIfShouldShowTour = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("has_seen_library_tour")
          .eq("id", user.id)
          .single();

        if (profile && !profile.has_seen_library_tour) {
          // Small delay to ensure DOM elements are ready
          setTimeout(() => {
            setShowTour(true);
            updateTargetPosition();
          }, 1500);
        }
      } catch (error) {
        console.error("Error checking tour status:", error);
      }
    };

    checkIfShouldShowTour();
  }, [user]);

  useEffect(() => {
    if (showTour) {
      updateTargetPosition();
      window.addEventListener("resize", updateTargetPosition);
      return () => window.removeEventListener("resize", updateTargetPosition);
    }
  }, [showTour, currentStep]);

  const updateTargetPosition = () => {
    const step = tourSteps[currentStep];
    const element = getTarget(step.target);

    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetPosition({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setShowTour(false);

    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ has_seen_library_tour: true })
          .eq("id", user.id);
        
        toast.success("Tour concluído! Você está pronto para começar.");
      } catch (error) {
        console.error("Error updating tour status:", error);
      }
    }
  };

  const handleSkip = async () => {
    setShowTour(false);

    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ has_seen_library_tour: true })
          .eq("id", user.id);
      } catch (error) {
        console.error("Error updating tour status:", error);
      }
    }
  };

  const getTooltipPosition = () => {
    const step = tourSteps[currentStep];
    const offset = 20;

    switch (step.placement) {
      case "top":
        return {
          top: targetPosition.top - offset,
          left: targetPosition.left + targetPosition.width / 2,
          transform: "translate(-50%, -100%)",
        };
      case "bottom":
        return {
          top: targetPosition.top + targetPosition.height + offset,
          left: targetPosition.left + targetPosition.width / 2,
          transform: "translateX(-50%)",
        };
      case "left":
        return {
          top: targetPosition.top + targetPosition.height / 2,
          left: targetPosition.left - offset,
          transform: "translate(-100%, -50%)",
        };
      case "right":
        return {
          top: targetPosition.top + targetPosition.height / 2,
          left: targetPosition.left + targetPosition.width + offset,
          transform: "translateY(-50%)",
        };
      default:
        return {};
    }
  };

  if (!showTour) return null;

  const step = tourSteps[currentStep];

  return (
    <AnimatePresence>
      {showTour && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[9998]"
            onClick={handleSkip}
          />

          {/* Highlight */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-[9999] pointer-events-none"
            style={{
              top: targetPosition.top - 4,
              left: targetPosition.left - 4,
              width: targetPosition.width + 8,
              height: targetPosition.height + 8,
              border: "3px solid hsl(var(--primary))",
              borderRadius: "0.5rem",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
            }}
          />

          {/* Tooltip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-[10000]"
            style={getTooltipPosition()}
          >
            <Card className="w-80 max-w-[90vw] glass border-primary/20 aura-soft">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 -mt-1 -mr-1"
                    onClick={handleSkip}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-muted-foreground">
                    {currentStep + 1} de {tourSteps.length}
                  </div>

                  <div className="flex gap-2">
                    {currentStep > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePrevious}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Voltar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleNext}
                      className="bg-gradient-to-r from-primary to-accent"
                    >
                      {currentStep === tourSteps.length - 1 ? "Finalizar" : "Próximo"}
                      {currentStep < tourSteps.length - 1 && (
                        <ChevronRight className="h-4 w-4 ml-1" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
