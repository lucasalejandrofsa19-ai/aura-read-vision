import { motion } from "framer-motion";
import { Smartphone, Download as DownloadIcon, Chrome, QrCode, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const Download = () => {
  const navigate = useNavigate();
  const appUrl = window.location.origin;

  const handleInstallPWA = () => {
    // For browsers that support PWA installation
    if ('BeforeInstallPromptEvent' in window) {
      alert("Clique no menu do seu navegador e selecione 'Adicionar à tela inicial' ou 'Instalar app'");
    } else {
      alert("Para instalar: Abra o menu do navegador → 'Adicionar à tela inicial'");
    }
  };

  return (
    <>
    <SEO
      title="Baixe a AURA READ — App de Leitura de PDFs"
      description="Instale a AURA READ no seu dispositivo e leia PDFs offline com IA, destaques e resumos."
      path="/download"
    />
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
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

      <div className="relative z-10 container max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="flex justify-center mb-4">
            <Smartphone className="w-16 h-16 text-primary aura-safira" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
            Baixe o App AURA READ
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Instale nosso app em seu celular e tenha acesso rápido à sua biblioteca
          </p>
        </motion.div>

        {/* Installation Cards */}
        <div className="grid gap-6 mb-8">
          {/* iOS Installation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                  <Chrome className="w-6 h-6 text-primary" />
                  iPhone / iPad (Safari)
                </CardTitle>
                <CardDescription>Como instalar no iOS</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm sm:text-base">Abra este site no Safari</p>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm sm:text-base">Toque no ícone de compartilhar (quadrado com seta)</p>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm sm:text-base">Role para baixo e toque em "Adicionar à Tela de Início"</p>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm sm:text-base">Confirme tocando em "Adicionar"</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Android Installation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                  <Chrome className="w-6 h-6 text-primary" />
                  Android (Chrome)
                </CardTitle>
                <CardDescription>Como instalar no Android</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm sm:text-base">Abra este site no Chrome</p>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm sm:text-base">Toque no menu (três pontos) no canto superior direito</p>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm sm:text-base">Selecione "Adicionar à tela inicial" ou "Instalar app"</p>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm sm:text-base">Confirme a instalação</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* QR Code Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-accent/20 hover:border-accent/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                  <QrCode className="w-6 h-6 text-accent" />
                  Acesso Rápido
                </CardTitle>
                <CardDescription>Compartilhe ou salve o link</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg break-all text-sm sm:text-base">
                  <code>{appUrl}</code>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Use este link para acessar o AURA READ de qualquer dispositivo
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button
            size="lg"
            onClick={handleInstallPWA}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity aura-safira w-full sm:w-auto"
          >
            <DownloadIcon className="mr-2 w-5 h-5" />
            Instalar Agora
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/library")}
            className="w-full sm:w-auto"
          >
            Ir para Biblioteca
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default Download;
