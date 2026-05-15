import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";

const Share = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  
  const shareUrl = `https://auraread.app/book/${id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
    <SEO
      title="Compartilhar Livro — AURA READ"
      description="Compartilhe seus livros e destaques com a comunidade AURA READ."
      path={`/share/${id ?? ""}`}
      noindex
    />
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() = aria-label="Voltar"> navigate(`/reader/${id}`)}
          className="mb-4 aura-soft transition-aura"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Share card */}
        <div className="glass rounded-2xl p-8 aura-soft text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mb-6"
          >
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              Compartilhar Livro
            </h1>
            <p className="text-sm text-muted-foreground">
              Compartilhe este livro com seus amigos
            </p>
          </motion.div>

          {/* QR Code */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-xl inline-block mb-6 aura-safira"
          >
            <QRCodeSVG
              value={shareUrl}
              size={200}
              level="H"
              includeMargin
              fgColor="#1a1f2e"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-sm text-muted-foreground mb-4">
              Escaneie o QR Code ou copie o link abaixo
            </p>

            {/* Link input */}
            <div className="flex gap-2">
              <div className="flex-1 glass rounded-lg px-4 py-3 text-sm text-left truncate border border-primary/20">
                {shareUrl}
              </div>
              <Button
                size="icon"
                onClick={handleCopy}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity aura-safira"
               aria-label="Confirmar">
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Não é necessário ter o app para visualizar
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
    </>
  );
};

export default Share;