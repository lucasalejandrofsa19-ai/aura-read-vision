import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface LibraryTourProps {
  onComplete?: () => void;
}

export const LibraryTour = ({ onComplete }: LibraryTourProps) => {
  const { user } = useAuth();
  const [runTour, setRunTour] = useState(false);
  const [shouldShowTour, setShouldShowTour] = useState(false);

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
          setShouldShowTour(true);
          // Small delay to ensure DOM elements are ready
          setTimeout(() => setRunTour(true), 1000);
        }
      } catch (error) {
        console.error("Error checking tour status:", error);
      }
    };

    checkIfShouldShowTour();
  }, [user]);

  const steps: Step[] = [
    {
      target: "body",
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Bem-vindo à sua Biblioteca! 📚</h3>
          <p>Vamos fazer um tour rápido pelos principais recursos.</p>
        </div>
      ),
      placement: "center",
      disableBeacon: true,
    },
    {
      target: '[data-tour="upload-button"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Adicionar Livros 📤</h3>
          <p>Clique aqui para fazer upload dos seus PDFs e adicionar à sua biblioteca.</p>
        </div>
      ),
      placement: "left",
    },
    {
      target: '[data-tour="search-bar"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Buscar na Biblioteca 🔍</h3>
          <p>Use a barra de pesquisa para encontrar livros por título ou autor rapidamente.</p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tour="book-card"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Seus Livros 📖</h3>
          <p>Clique em qualquer livro para começar a ler. Durante a leitura, você pode:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Destacar texto importante</li>
            <li>Fazer anotações</li>
            <li>Navegar entre páginas</li>
            <li>Compartilhar destaques</li>
          </ul>
        </div>
      ),
      placement: "top",
    },
    {
      target: '[data-tour="profile-button"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Seu Perfil 👤</h3>
          <p>Acesse suas configurações, veja seus destaques e gerencie sua conta.</p>
        </div>
      ),
      placement: "bottom",
    },
  ];

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      
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

      if (onComplete) {
        onComplete();
      }

      if (status === STATUS.FINISHED) {
        toast.success("Tour concluído! Você está pronto para começar.");
      }
    }
  };

  if (!shouldShowTour) return null;

  return (
    <Joyride
      steps={steps}
      run={runTour}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: "1rem",
          padding: "1.5rem",
        },
        buttonNext: {
          backgroundColor: "hsl(var(--primary))",
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          fontWeight: 600,
        },
        buttonBack: {
          color: "hsl(var(--muted-foreground))",
          marginRight: "0.5rem",
          fontSize: "0.875rem",
        },
        buttonSkip: {
          color: "hsl(var(--muted-foreground))",
          fontSize: "0.875rem",
        },
      }}
      locale={{
        back: "Voltar",
        close: "Fechar",
        last: "Finalizar",
        next: "Próximo",
        skip: "Pular",
      }}
    />
  );
};
