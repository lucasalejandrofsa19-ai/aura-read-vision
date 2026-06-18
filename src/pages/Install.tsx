import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import { ArrowLeft, Smartphone, Monitor, CheckCircle, Download, Zap, Sparkles, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePWAInstallPrompt } from "@/hooks/usePWAInstallPrompt";
import { useABTest } from "@/hooks/useABTest";
import installIOS from "@/assets/install-ios.png";
import installAndroid from "@/assets/install-android.png";
import installDesktop from "@/assets/install-desktop.png";
import LibraryCTA from "@/components/LibraryCTA";

const Install = () => {
  const navigate = useNavigate();
  const { isInstallable, isInstalled, installPrompt } = usePWAInstallPrompt();
  
  // Teste A/B do botão de instalação
  const { selectedVariant, trackConversion } = useABTest("pwa_install_button", [
    { id: "variant_a", name: "Gradient Lightning" },
    { id: "variant_b", name: "Outline Classic" },
    { id: "variant_c", name: "Solid Free" },
    { id: "variant_d", name: "Urgency Speed" },
  ]);

  const handleInstallClick = () => {
    trackConversion();
    installPrompt();
  };

  // Configurações das variantes
  const getButtonVariant = () => {
    switch (selectedVariant) {
      case "variant_a":
        return {
          text: "Instalar Agora (1 Clique)",
          icon: Zap,
          className: "bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity",
          iconAnimation: "group-hover:animate-pulse"
        };
      case "variant_b":
        return {
          text: "Adicionar à Tela Inicial",
          icon: Download,
          className: "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors",
          iconAnimation: "group-hover:translate-y-1 transition-transform"
        };
      case "variant_c":
        return {
          text: "Baixar App Grátis",
          icon: Sparkles,
          className: "bg-primary hover:bg-primary/90 transition-colors",
          iconAnimation: "group-hover:rotate-12 transition-transform"
        };
      case "variant_d":
        return {
          text: "Instalar em 1 Segundo ⚡",
          icon: Rocket,
          className: "bg-gradient-to-r from-accent to-primary hover:scale-105 transition-transform",
          iconAnimation: "group-hover:translate-x-1 transition-transform"
        };
      default:
        return {
          text: "Instalar Agora",
          icon: Download,
          className: "bg-primary hover:bg-primary/90",
          iconAnimation: ""
        };
    }
  };

  const buttonConfig = getButtonVariant();

  return (
    <>
    <SEO
      title="Como Instalar — AURA READ"
      description="Aprenda a instalar a AURA READ como app no iOS, Android e desktop."
      path="/install"
    />
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass border-b border-border/50 sticky top-0 z-50"
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="aura-soft transition-aura"
           aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Instalar AURA READ</h1>
            <p className="text-sm text-muted-foreground">
              Guia completo de instalação
            </p>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-4xl mx-auto px-6 py-12"
      >
        {/* Intro Section */}
        <Card className="glass p-8 mb-8">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <Download className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-3">
                Instale o AURA READ como um App
              </h2>
              <p className="text-muted-foreground mb-4">
                O AURA READ é um Progressive Web App (PWA) que pode ser instalado
                diretamente no seu dispositivo. Aproveite todos os benefícios de
                um aplicativo nativo sem precisar baixar nada da loja.
              </p>

              {/* Botão de instalação automática com teste A/B */}
              {isInstallable && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <Button
                    onClick={handleInstallClick}
                    size="lg"
                    className={`${buttonConfig.className} group w-full sm:w-auto`}
                  >
                    <buttonConfig.icon className={`w-5 h-5 mr-2 ${buttonConfig.iconAnimation}`} />
                    {buttonConfig.text}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    ⚡ Instalação rápida disponível no seu navegador
                  </p>
                </motion.div>
              )}

              {isInstalled && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-semibold text-primary">App já instalado! ✅</p>
                      <p className="text-sm text-muted-foreground">
                        Você já tem o AURA READ instalado no seu dispositivo
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 mt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Acesso Instantâneo</p>
                    <p className="text-sm text-muted-foreground">
                      Abra direto da tela inicial
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Funciona Offline</p>
                    <p className="text-sm text-muted-foreground">
                      Leia seus livros sem internet
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Sem Downloads</p>
                    <p className="text-sm text-muted-foreground">
                      Não ocupa espaço na loja
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Atualizações Automáticas</p>
                    <p className="text-sm text-muted-foreground">
                      Sempre a versão mais recente
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Installation Instructions */}
        <Tabs defaultValue="ios" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="ios" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              iPhone
            </TabsTrigger>
            <TabsTrigger value="android" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Android
            </TabsTrigger>
            <TabsTrigger value="desktop" className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Desktop
            </TabsTrigger>
          </TabsList>

          {/* iOS Instructions */}
          <TabsContent value="ios" className="space-y-6">
            <Card className="glass p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                Instalar no iPhone (Safari)
              </h3>

              <div className="space-y-6">
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">Abra o Safari</p>
                      <p className="text-sm text-muted-foreground">
                        Certifique-se de estar usando o navegador Safari no seu iPhone.
                        Outros navegadores não suportam a instalação de PWAs no iOS.
                      </p>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">
                        Toque no botão de compartilhar
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Na barra inferior do Safari, toque no ícone de compartilhar
                        (um quadrado com uma seta apontando para cima).
                      </p>
                      <img
                        src={installIOS}
                        alt="Botão compartilhar do Safari"
                        className="w-full rounded-lg border border-border/50 shadow-lg"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">
                        Selecione "Adicionar à Tela de Início"
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Role para baixo no menu de compartilhamento e toque em
                        "Adicionar à Tela de Início". Você pode personalizar o nome
                        do app se desejar.
                      </p>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      4
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">Confirme a instalação</p>
                      <p className="text-sm text-muted-foreground">
                        Toque em "Adicionar" no canto superior direito. O ícone do
                        AURA READ aparecerá na sua tela inicial!
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Android Instructions */}
          <TabsContent value="android" className="space-y-6">
            <Card className="glass p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                Instalar no Android (Chrome)
              </h3>

              <div className="space-y-6">
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">Abra o Chrome</p>
                      <p className="text-sm text-muted-foreground">
                        Acesse o AURA READ usando o navegador Google Chrome no seu
                        dispositivo Android.
                      </p>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">Abra o menu do navegador</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Toque nos três pontos verticais (⋮) no canto superior direito
                        do navegador para abrir o menu.
                      </p>
                      <img
                        src={installAndroid}
                        alt="Menu do Chrome no Android"
                        className="w-full rounded-lg border border-border/50 shadow-lg"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">Toque em "Instalar app"</p>
                      <p className="text-sm text-muted-foreground">
                        No menu, selecione a opção "Instalar app" ou "Adicionar à
                        tela inicial". O Chrome mostrará um banner de confirmação.
                      </p>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      4
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">Confirme a instalação</p>
                      <p className="text-sm text-muted-foreground">
                        Toque em "Instalar" na janela de confirmação. O AURA READ
                        será adicionado à sua tela inicial e gaveta de aplicativos!
                      </p>
                    </div>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="p-4 bg-muted/50 rounded-lg"
                >
                  <p className="text-sm font-medium mb-2">💡 Dica:</p>
                  <p className="text-sm text-muted-foreground">
                    Alguns dispositivos Android também mostram um banner automático
                    "Adicionar à tela inicial" quando você visita o AURA READ. Você
                    pode tocar neste banner como atalho para instalação.
                  </p>
                </motion.div>
              </div>
            </Card>
          </TabsContent>

          {/* Desktop Instructions */}
          <TabsContent value="desktop" className="space-y-6">
            <Card className="glass p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
                Instalar no Computador
              </h3>

              <div className="space-y-6">
                {/* Chrome/Edge */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Chrome / Edge / Brave</h4>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">
                        Procure o ícone de instalação
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Na barra de endereço, procure pelo ícone de instalação (um
                        computador com uma seta para baixo) no lado direito.
                      </p>
                      <img
                        src={installDesktop}
                        alt="Ícone de instalação no Chrome"
                        className="w-full rounded-lg border border-border/50 shadow-lg"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">Clique em "Instalar"</p>
                      <p className="text-sm text-muted-foreground">
                        Clique no ícone e depois em "Instalar" na janela que
                        aparecer. O AURA READ será instalado como um aplicativo no
                        seu computador.
                      </p>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">Acesse o aplicativo</p>
                      <p className="text-sm text-muted-foreground">
                        Após a instalação, você pode abrir o AURA READ:
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground ml-4">
                        <li>• Windows: Menu Iniciar ou barra de tarefas</li>
                        <li>• Mac: Pasta de Aplicativos ou Launchpad</li>
                        <li>• Linux: Menu de aplicativos do sistema</li>
                      </ul>
                    </div>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="p-4 bg-muted/50 rounded-lg space-y-2"
                >
                  <p className="text-sm font-medium">📝 Método alternativo:</p>
                  <p className="text-sm text-muted-foreground">
                    Você também pode instalar através do menu do navegador:
                  </p>
                  <ul className="text-sm text-muted-foreground ml-4 space-y-1">
                    <li>• Chrome/Edge: Menu (⋮) → "Instalar AURA READ..."</li>
                    <li>• Brave: Menu (☰) → "Instalar AURA READ..."</li>
                  </ul>
                </motion.div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* FAQ Section */}
        <Card className="glass p-8 mt-8">
          <h3 className="text-xl font-bold mb-6">Perguntas Frequentes</h3>
          
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <p className="font-medium mb-2">
                O app instalado ocupa muito espaço no meu dispositivo?
              </p>
              <p className="text-sm text-muted-foreground">
                Não! Como é um PWA, o AURA READ ocupa muito pouco espaço (apenas
                alguns KB) comparado a aplicativos tradicionais. Os dados são
                armazenados no cache do navegador de forma eficiente.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <p className="font-medium mb-2">
                Preciso atualizar o app manualmente?
              </p>
              <p className="text-sm text-muted-foreground">
                Não! O AURA READ atualiza automaticamente sempre que há uma nova
                versão disponível. Você sempre terá a versão mais recente sem
                precisar fazer nada.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <p className="font-medium mb-2">
                Posso desinstalar o app quando quiser?
              </p>
              <p className="text-sm text-muted-foreground">
                Sim! Você pode desinstalar o AURA READ a qualquer momento como
                qualquer outro app no seu dispositivo. Em dispositivos móveis,
                pressione e segure o ícone e selecione "Remover". No desktop, use
                as configurações do sistema operacional.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <p className="font-medium mb-2">
                Meus dados ficam salvos mesmo depois de desinstalar?
              </p>
              <p className="text-sm text-muted-foreground">
                Sim! Seus livros, notas e destaques ficam salvos na nuvem. Quando
                você reinstalar ou acessar de outro dispositivo, todos os seus
                dados estarão lá.
              </p>
            </motion.div>
          </div>
        </Card>

        {/* CTA */}
        <div className="mt-8">
          <LibraryCTA />
        </div>
      </motion.main>
    </div>
    </>
  );
};

export default Install;
