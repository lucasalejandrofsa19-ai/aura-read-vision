import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Trash2, RefreshCw, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LazyImage } from "@/components/LazyImage";

interface Book {
  id: string;
  title: string;
  author: string;
  cover_color: string;
  progress?: number;
  file_path: string;
  cover_image_url?: string;
}

interface BookCardProps {
  book: Book;
  index: number;
  onDelete?: () => void;
  isPremiumBook?: boolean;
  isAdmin?: boolean;
  onReprocess?: () => void;
}

const BookCard = ({ book, index, onDelete, isPremiumBook = false, isAdmin = false, onReprocess }: BookCardProps) => {
  const navigate = useNavigate();
  const [reprocessing, setReprocessing] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Deseja realmente deletar este livro?")) return;

    try {
      // Delete file from storage
      if (book.file_path) {
        const bucket = isPremiumBook ? "premium-pdfs" : "pdfs";
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([book.file_path]);
        
        if (storageError) captureError(storageError, { context: "delete_storage_file" });
      }

      // Delete book record
      const table = isPremiumBook ? "premium_books" : "books";
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", book.id);

      if (error) throw error;

      toast.success("Livro deletado com sucesso!");
      onDelete?.();
    } catch (error) {
      captureError(error, { context: "delete_book" });
      toast.error("Erro ao deletar livro");
    }
  };

  const handleReprocess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Deseja reprocessar este PDF? Isso irá extrair novamente o texto e gerar uma nova thumbnail.")) return;

    setReprocessing(true);
    toast.loading("Processando PDF...", { id: "reprocess" });

    try {
      const { data, error } = await supabase.functions.invoke('process-premium-pdf', {
        body: { bookId: book.id },
      });

      if (error) throw error;

      toast.success(
        `PDF reprocessado com sucesso! ${data.totalPages} páginas extraídas`,
        { id: "reprocess" }
      );
      
      onReprocess?.();
    } catch (error) {
      captureError(error, { context: "reprocess_premium_pdf" });
      toast.error("Erro ao reprocessar PDF", { id: "reprocess" });
    } finally {
      setReprocessing(false);
    }
  };

  const handleOpenGallery = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowGallery(true);
    setLoadingGallery(true);

    try {
      const { data: highlights, error: highlightsError } = await supabase
        .from("highlights")
        .select("id")
        .eq("book_id", book.id);

      if (highlightsError) throw highlightsError;

      if (highlights && highlights.length > 0) {
        const highlightIds = highlights.map(h => h.id);
        
        const { data: images, error: imagesError } = await supabase
          .from("highlight_images")
          .select("*")
          .in("highlight_id", highlightIds)
          .order("created_at", { ascending: false });

        if (imagesError) throw imagesError;
        setGalleryImages(images || []);
      } else {
        setGalleryImages([]);
      }
    } catch (error) {
      captureError(error, { context: "load_book_gallery" });
      toast.error("Erro ao carregar galeria");
    } finally {
      setLoadingGallery(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="cursor-pointer group perspective-1000"
      onClick={() => navigate(`/reader/${book.id}`)}
    >
      <motion.div
        whileHover={{ rotateY: -5, scale: 1.05 }}
        transition={{ duration: 0.3 }}
        className="relative preserve-3d"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Book spine shadow for 3D effect */}
        <div className="absolute -left-2 top-4 bottom-4 w-2 bg-gradient-to-r from-black/40 to-transparent rounded-l-sm" />
        
        {/* Book cover card */}
        <div className="glass rounded-xl overflow-hidden shadow-2xl transition-aura hover:aura-safira">
          {/* Book cover front */}
          <div className={`relative h-72 ${book.cover_image_url ? 'bg-muted' : `bg-gradient-to-br ${book.cover_color || 'from-blue-500 to-blue-700'}`} p-6 flex flex-col justify-between overflow-hidden`}>
            {/* Thumbnail image or texture overlay */}
            {book.cover_image_url ? (
              <LazyImage
                src={book.cover_image_url} 
                alt={book.title}
                className="absolute inset-0 w-full h-full object-cover"
                placeholderClassName="absolute inset-0"
              />
            ) : (
              <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] pointer-events-none" />
            )}
            
            {/* Gradient overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            
            <div className="flex justify-between items-start relative z-10">
              <BookOpen className="w-8 h-8 text-white/90 drop-shadow-lg" />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenGallery}
                  className="w-8 h-8 rounded-full bg-purple-500/20 hover:bg-purple-500/40 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                  title="Galeria de Imagens"
                >
                  <Images className="w-4 h-4" />
                </Button>
                {isAdmin && isPremiumBook && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReprocess}
                    disabled={reprocessing}
                    className="w-8 h-8 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm disabled:opacity-50"
                    title="Reprocessar PDF"
                  >
                    <RefreshCw className={`w-4 h-4 ${reprocessing ? 'animate-spin' : ''}`} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/40 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <span className="text-white text-xs font-bold drop-shadow">{book.progress}%</span>
                </div>
              </div>
            </div>
            
            <div className="relative z-10">
              <h3 className="text-white text-xl font-bold mb-1 line-clamp-2 drop-shadow-lg">
                {book.title}
              </h3>
              <p className="text-white/90 text-sm drop-shadow">{book.author || "Autor Desconhecido"}</p>
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${book.progress}%` }}
                transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
                className="h-full bg-white shadow-lg"
              />
            </div>

            {/* Book spine highlight */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-r from-white/30 to-transparent" />
          </div>

          {/* Card footer */}
          <div className="p-4 bg-gradient-to-b from-background to-muted/20">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Continue lendo
            </p>
          </div>
        </div>
      </motion.div>

      {/* Gallery Dialog */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Images className="w-5 h-5" />
              Galeria de Imagens - {book.title}
            </DialogTitle>
          </DialogHeader>
          
          {loadingGallery ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : galleryImages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Images className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma imagem gerada para este livro ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {galleryImages.map((image) => (
                <div key={image.id} className="relative group">
                  <LazyImage
                    src={image.image_url}
                    alt={image.style}
                    className="w-full h-48 object-cover rounded-lg border border-border"
                    placeholderClassName="w-full h-48 rounded-lg border border-border"
                  />
                  <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded text-xs">
                    <p className="font-medium capitalize">{image.style}</p>
                    <p className="text-[10px] opacity-80">
                      {format(new Date(image.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default BookCard;