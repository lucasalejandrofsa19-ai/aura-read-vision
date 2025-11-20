import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const usePWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const { toast, dismiss } = useToast();

  useEffect(() => {
    // Detectar se já está instalado
    const checkIfInstalled = () => {
      const nav = window.navigator as Navigator & { standalone?: boolean };
      if (nav.standalone || window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return true;
      }
      return false;
    };

    if (checkIfInstalled()) {
      return;
    }

    // Capturar o evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevenir o prompt padrão do navegador
      e.preventDefault();
      
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);

      // Mostrar toast customizado
      const toastId = toast({
        duration: 10000, // 10 segundos
        className: "glass border-2 border-primary/20",
        description: (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold mb-1">Instalar AURA READ</p>
              <p className="text-sm text-muted-foreground">
                Instale o app para acesso rápido e experiência offline
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  handleInstallClick();
                  dismiss();
                }}
                className="bg-gradient-to-r from-primary to-accent"
              >
                Instalar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dismiss()}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ),
      });
    };

    // Detectar quando o app foi instalado
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);

      // Mostrar toast de sucesso
      toast({
        duration: 5000,
        className: "glass border-2 border-primary/20",
        description: (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">App instalado com sucesso! 🎉</p>
              <p className="text-sm text-muted-foreground">
                Você pode acessar o AURA READ direto da tela inicial
              </p>
            </div>
          </div>
        ),
      });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [toast, dismiss]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Mostrar o prompt de instalação
    deferredPrompt.prompt();

    // Aguardar a escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("Usuário aceitou a instalação");
    } else {
      console.log("Usuário recusou a instalação");
    }

    // Limpar o prompt salvo
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return {
    isInstallable,
    isInstalled,
    installPrompt: handleInstallClick,
  };
};
