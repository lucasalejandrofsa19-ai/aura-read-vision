import { useState, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image, Download, Loader2, Trash2, Images, AlertCircle, Crown, X, Maximize2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HighlightImageDialogProps {
  text: string;
  highlightId: string;
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

export const HighlightImageDialog = ({ text, highlightId, trigger }: HighlightImageDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [style, setStyle] = useState<ImageStyle>("photorealistic");
  const [gallery, setGallery] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [imageCount, setImageCount] = useState(0);
  const [showLimitWarning, setShowLimitWarning] = useState(false);

  const FREE_IMAGE_LIMIT = 3;

  const loadGallery = async () => {
    setLoadingGallery(true);
    try {
      const { data, error } = await supabase
        .from('highlight_images')
        .select('*')
        .eq('highlight_id', highlightId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGallery(data || []);
    } catch (error) {
      console.error('Error loading gallery:', error);
    } finally {
      setLoadingGallery(false);
    }
  };

  const loadImageCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('highlight_images')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error loading image count:', error);
      return 0;
    }
  };

  const generateImage = async () => {
    setLoading(true);
    setImageUrl(null);
    toast.loading("Gerando imagem...", { id: "generate-image" });

    try {
      const { data, error } = await supabase.functions.invoke('text-to-image', {
        body: { text, style, highlightId },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error === 'limit_reached') {
          toast.error(data.message, { 
            id: "generate-image",
            duration: 6000,
            action: {
              label: 'Ver Planos',
              onClick: () => window.location.href = '/pricing'
            }
          });
        } else if (data.error.includes('Rate limit')) {
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
      
      loadGallery();
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error("Erro ao gerar imagem", { id: "generate-image" });
    } finally {
      setLoading(false);
    }
  };

  const deleteImage = async (imageId: string, storagePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('highlight-images')
        .remove([storagePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('highlight_images')
        .delete()
        .eq('id', imageId);

      if (dbError) throw dbError;

      toast.success("Imagem deletada!");
      loadGallery();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error("Erro ao deletar imagem");
    }
  };

  const downloadImage = (url?: string) => {
    const targetUrl = url || imageUrl;
    if (!targetUrl) return;

    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = `highlight-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Imagem baixada!");
  };

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      loadGallery();
      const count = await loadImageCount();
      setImageCount(count);
      setShowLimitWarning(count >= FREE_IMAGE_LIMIT);
    } else {
      setImageUrl(null);
    }
  };

  useEffect(() => {
    if (open) {
      loadGallery();
      loadImageCount().then(count => {
        setImageCount(count);
        setShowLimitWarning(count >= FREE_IMAGE_LIMIT);
      });
    }
  }, [open]);

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
              {/* Usage Warning */}
              {showLimitWarning && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-sm">
                    Você já usou {imageCount} de {FREE_IMAGE_LIMIT} imagens gratuitas.
                    {imageCount >= FREE_IMAGE_LIMIT ? (
                      <>
                        {" "}Para gerar mais imagens, 
                        <Button 
                          variant="link" 
                          className="h-auto p-0 ml-1 text-amber-500 hover:text-amber-600 inline-flex items-center gap-1"
                          onClick={() => window.location.href = '/pricing'}
                        >
                          <Crown className="w-3 h-3" />
                          assine o plano Premium
                        </Button>
                      </>
                    ) : (
                      <> Restam {FREE_IMAGE_LIMIT - imageCount} imagens gratuitas.</>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Usage Counter for all users */}
              {!showLimitWarning && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Imagens geradas: {imageCount}</span>
                  <span>{imageCount < FREE_IMAGE_LIMIT ? `${FREE_IMAGE_LIMIT - imageCount} gratuitas restantes` : 'Premium ilimitado'}</span>
                </div>
              )}

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
              <div className="rounded-lg overflow-hidden border border-border bg-muted/20 relative group">
                <img 
                  src={imageUrl} 
                  alt="Imagem gerada do destaque" 
                  className="w-full h-auto cursor-pointer"
                  onClick={() => setFullscreenImage(imageUrl)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setFullscreenImage(imageUrl)}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => downloadImage()} 
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

          {/* Gallery Section */}
          {gallery.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-t pt-4">
                <Images className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Histórico de Imagens ({gallery.length})</h3>
              </div>

              {loadingGallery ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="grid grid-cols-2 gap-3">
                    {gallery.map((img) => (
                      <div key={img.id} className="group relative rounded-lg overflow-hidden border border-border bg-muted/20">
                        <img 
                          src={img.image_url} 
                          alt={`Imagem ${styleLabels[img.style as ImageStyle]}`}
                          className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setFullscreenImage(img.image_url)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                            <p className="text-xs font-medium">{styleLabels[img.style as ImageStyle]}</p>
                            <p className="text-xs opacity-80">
                              {format(new Date(img.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="absolute top-2 right-2 flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadImage(img.image_url);
                              }}
                              className="h-6 w-6 bg-green-500/80 hover:bg-green-500 text-white"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteImage(img.id, img.storage_path);
                              }}
                              className="h-6 w-6 bg-red-500/80 hover:bg-red-500 text-white"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full z-10"
              onClick={() => setFullscreenImage(null)}
            >
              <X className="w-6 h-6" />
            </Button>

            {/* Save Button */}
            <Button
              variant="default"
              className="absolute bottom-8 left-1/2 -translate-x-1/2 gap-2 bg-primary/90 hover:bg-primary z-10"
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(fullscreenImage);
              }}
            >
              <Download className="w-4 h-4" />
              Salvar Imagem
            </Button>

            {/* Image */}
            <img 
              src={fullscreenImage}
              alt="Imagem em tela cheia"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </Dialog>
  );
};
