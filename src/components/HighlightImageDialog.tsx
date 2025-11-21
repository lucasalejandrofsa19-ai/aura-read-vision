import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image, Download, Loader2 } from "lucide-react";

interface HighlightImageDialogProps {
  text: string;
  trigger?: React.ReactNode;
}

type ImageStyle = "photorealistic" | "cartoon" | "painting" | "minimalist";

const styleLabels: Record<ImageStyle, string> = {
  photorealistic: "Fotorrealista",
  cartoon: "Cartoon",
  painting: "Pintura",
  minimalist: "Minimalista",
};

const stylePrompts: Record<ImageStyle, string> = {
  photorealistic: "photorealistic, highly detailed, realistic lighting, professional photography",
  cartoon: "cartoon style, vibrant colors, animated, playful, illustrated",
  painting: "oil painting style, artistic, textured brushstrokes, gallery quality",
  minimalist: "minimalist design, clean lines, simple shapes, modern, elegant",
};

export const HighlightImageDialog = ({ text, trigger }: HighlightImageDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [style, setStyle] = useState<ImageStyle>("photorealistic");

  const generateImage = async () => {
    setLoading(true);
    setImageUrl(null); // Clear previous image
    toast.loading("Gerando imagem...", { id: "generate-image" });

    try {
      const { data, error } = await supabase.functions.invoke('text-to-image', {
        body: { text, style },
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
      toast.success(`Imagem gerada com sucesso em estilo ${styleLabels[style]}!`, { id: "generate-image" });
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

          {!imageUrl && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="style-select">Estilo da Imagem</Label>
                <Select value={style} onValueChange={(value) => setStyle(value as ImageStyle)}>
                  <SelectTrigger id="style-select" className="w-full">
                    <SelectValue placeholder="Escolha um estilo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(styleLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {style === "photorealistic" && "Imagem realista e detalhada como uma fotografia"}
                  {style === "cartoon" && "Estilo animado e colorido"}
                  {style === "painting" && "Pintura artística com textura"}
                  {style === "minimalist" && "Design limpo e simples"}
                </p>
              </div>

              <Button 
                onClick={generateImage} 
                className="w-full gap-2"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Image className="w-4 h-4" />
                    Gerar Imagem com IA
                  </>
                )}
              </Button>
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
