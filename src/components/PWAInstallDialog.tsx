import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download, CheckCircle, Smartphone, Monitor, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PWAInstallDialogProps {
  children: React.ReactNode;
}

export const PWAInstallDialog = ({ children }: PWAInstallDialogProps) => {
  const navigate = useNavigate();
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(isInStandaloneMode);
    setIsInstalled(isInStandaloneMode);

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app was installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      toast.success("App instalado com sucesso!");
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.info("Abra o menu do navegador e selecione 'Instalar App' ou 'Adicionar à tela inicial'");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success("Instalação iniciada!");
    }
    
    setDeferredPrompt(null);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="glass sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            AURA READ - PWA
          </DialogTitle>
          <DialogDescription>
            Instale o AURA READ como um aplicativo no seu dispositivo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Installation Status */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            {isInstalled ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium">App Instalado</p>
                  <p className="text-sm text-muted-foreground">
                    O AURA READ está instalado no seu dispositivo
                  </p>
                </div>
              </>
            ) : (
              <>
                <Download className="w-5 h-5 text-accent" />
                <div>
                  <p className="font-medium">Não Instalado</p>
                  <p className="text-sm text-muted-foreground">
                    Instale para acesso rápido offline
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            <p className="font-medium text-sm">Benefícios da instalação:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Acesso rápido pela tela inicial</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Funciona offline após o primeiro acesso</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Experiência como app nativo</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Carregamento mais rápido</span>
              </li>
            </ul>
          </div>

          {/* Installation Instructions */}
          {!isInstalled && (
            <div className="space-y-3 pt-2">
              <p className="font-medium text-sm">Como instalar:</p>
              
              <div className="space-y-2">
                <div className="flex items-start gap-3 text-sm">
                  <Smartphone className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">No celular:</p>
                    <p className="text-muted-foreground">
                      iPhone: Safari → Compartilhar → Adicionar à Tela de Início
                    </p>
                    <p className="text-muted-foreground">
                      Android: Chrome → Menu (⋮) → Instalar App
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-sm">
                  <Monitor className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">No computador:</p>
                    <p className="text-muted-foreground">
                      Chrome/Edge: Ícone de instalação na barra de endereço
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Install Button */}
          {!isInstalled && deferredPrompt && (
            <Button 
              onClick={handleInstallClick}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Instalar App
            </Button>
          )}

          {/* Link to detailed instructions */}
          <Button
            variant="outline"
            onClick={() => navigate("/install")}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Ver Guia Completo de Instalação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
