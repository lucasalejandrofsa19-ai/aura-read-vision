import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image, Download, Loader2 } from "lucide-react";

interface HighlightImageDialogProps {
  text: string;
  trigger?: React.ReactNode;
}

export const HighlightImageDialog = ({ text, trigger }: HighlightImageDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const generateImage = async () => {
    setLoading(true);
    toast.loading("Gerando imagem...", { id: "generate-image" });

    try {
      const { data, error } = await supabase.functions.invoke('text-to-image', {
        body: { text },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes('Rate limit')) {
          toast.error("Limite de requisições atingido. Tente novamente em alguns instantes.", { id: "generate-image" });
        } else if (data.error.includes('Payment required')) {
          toast.error("Créditos insuficientes. Adicione créditos no seu workspace.", { id: "generate-image" });
        } else {
          toast.error(data.error, { id: "generate-image" });
        }
        return;
      }

      setImageUrl(data.imageUrl);
      toast.success("Imagem gerada com sucesso!", { id: "generate-image" });
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error("Erro ao gerar imagem", { id: "generate-image" });
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `highlight-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Imagem baixada!");
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setImageUrl(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="h-8 w-8"
          title="Gerar imagem com IA"
        >
          <Image className="w-3 h-3" />
        </Button>
      )}

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar Imagem do Destaque</DialogTitle>
          <DialogDescription>
            Transforme seu destaque em uma ilustração visual usando IA
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm line-clamp-3">{text}</p>
          </div>

          {!imageUrl && !loading && (
            <Button 
              onClick={generateImage} 
              className="w-full gap-2"
              size="lg"
            >
              <Image className="w-4 h-4" />
              Gerar Imagem com IA
            </Button>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Gerando imagem... Isso pode levar alguns segundos
              </p>
            </div>
          )}

          {imageUrl && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
                <img 
                  src={imageUrl} 
                  alt="Imagem gerada do destaque" 
                  className="w-full h-auto"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={downloadImage} 
                  className="flex-1 gap-2"
                  variant="outline"
                >
                  <Download className="w-4 h-4" />
                  Baixar Imagem
                </Button>
                <Button 
                  onClick={generateImage} 
                  className="flex-1 gap-2"
                  disabled={loading}
                >
                  <Image className="w-4 h-4" />
                  Gerar Nova
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
