import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Trash2, RefreshCw, Images, ImagePlus, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LazyImage } from "@/components/LazyImage";
import { SelectCoverPageDialog } from "@/components/SelectCoverPageDialog";
import { useGenerateCover } from "@/hooks/useGenerateCover";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface Book {
  id: string;
  title: string;
  author: string;
  cover_color: string;
  progress?: number;
  file_path: string;
  cover_image_url?: string;
  total_pages?: number;
  file_url?: string;
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [reprocessing, setReprocessing] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showSelectPage, setShowSelectPage] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { generateCover, generating: generatingCover } = useGenerateCover();

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

      // Invalidate cache immediately for instant UI update
      if (isPremiumBook) {
        queryClient.invalidateQueries({ queryKey: ["premium-books"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["books", user?.id] });
      }

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

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5242880) {
      toast.error("Imagem muito grande. Limite de 5MB");
      return;
    }

    setUploadingCover(true);
    toast.loading("Fazendo upload da capa...", { id: "cover-upload" });

    try {
      const bucket = isPremiumBook ? "premium-covers" : "premium-covers";
      const fileName = `${book.id}-custom-cover.${file.name.split('.').pop()}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      // Update book record
      const table = isPremiumBook ? "premium_books" : "books";
      const { error: updateError } = await supabase
        .from(table)
        .update({ cover_image_url: urlData.publicUrl })
        .eq("id", book.id);

      if (updateError) throw updateError;

      toast.success("Capa atualizada com sucesso!", { id: "cover-upload" });
      
      // Refresh the page or callback
      onReprocess?.();
      
    } catch (error) {
      captureError(error, { context: "upload_custom_cover" });
      toast.error("Erro ao fazer upload da capa", { id: "cover-upload" });
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = "";
      }
    }
  };

  const handleSelectCoverPage = async (pageNumber: number) => {
    if (!book.file_url) {
      toast.error("URL do PDF não disponível");
      return;
    }

    toast.loading("Gerando capa...", { id: "generate-cover" });

    try {
      await generateCover(book.id, book.file_url, pageNumber);
      toast.success("✨ Capa gerada com sucesso!", { id: "generate-cover" });
      setShowSelectPage(false);
      onReprocess?.();
    } catch (error) {
      captureError(error, { context: "generate_cover_from_page" });
      toast.error("Erro ao gerar capa", { id: "generate-cover" });
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
    <>
      {/* Hidden file input for cover upload */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadCover}
        className="hidden"
      />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="cursor-pointer group relative"
        onClick={() => navigate(`/reader/${book.id}`)}
      >
      {/* Book standing on shelf */}
      <div className="relative perspective-1000">
        {/* Book spine and shadow */}
        <motion.div
          whileHover={{ rotateY: -8, z: 20 }}
          transition={{ duration: 0.3 }}
          className="relative preserve-3d"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Shelf shadow */}
          <div className="absolute -bottom-2 left-0 right-0 h-8 bg-gradient-to-t from-black/30 to-transparent blur-sm" />
          
          {/* Book spine (lado visível quando em pé) */}
          <div className="absolute -left-3 top-0 bottom-0 w-12 rounded-l-lg shadow-2xl overflow-hidden"
               style={{
                 transform: "rotateY(90deg) translateZ(-24px)",
                 transformStyle: "preserve-3d"
               }}>
            <div className={`w-full h-full ${book.cover_color || 'bg-gradient-to-b from-blue-500 to-blue-700'} p-2 flex flex-col items-center justify-center`}>
              <span className="text-white font-bold text-xs writing-mode-vertical transform rotate-180 line-clamp-3 text-center">
                {book.title}
              </span>
            </div>
          </div>

          {/* Book cover (frente) */}
          <div className="glass rounded-lg overflow-hidden shadow-2xl transition-all duration-300 group-hover:shadow-primary/50">
            <div className={`relative h-80 ${book.cover_image_url ? 'bg-background' : `bg-gradient-to-br ${book.cover_color || 'from-blue-500 to-blue-700'}`} overflow-hidden`}>
              {/* Cover Image */}
              {book.cover_image_url ? (
                <LazyImage
                  src={book.cover_image_url} 
                  alt={book.title}
                  className="absolute inset-0 w-full h-full object-contain"
                  containerClassName="absolute inset-0"
                />
              ) : (
                <>
                  <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] pointer-events-none" />
                  
                  {/* Generating cover indicator */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white/80 p-4">
                      <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm font-medium">Gerando capa...</p>
                    </div>
                  </div>
                </>
              )}
              
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              
              {/* Title and author on cover */}
              <div className="absolute inset-0 p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <BookOpen className="w-6 h-6 text-white/90 drop-shadow-lg" />
                  
                  {/* Action buttons */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSelectPage(true);
                      }}
                      disabled={generatingCover}
                      className="w-7 h-7 rounded-full bg-blue-500/30 hover:bg-blue-500/50 text-white backdrop-blur-sm"
                      title="Escolher Página da Capa"
                    >
                      {generatingCover ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FileImage className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        coverInputRef.current?.click();
                      }}
                      disabled={uploadingCover}
                      className="w-7 h-7 rounded-full bg-green-500/30 hover:bg-green-500/50 text-white backdrop-blur-sm"
                      title="Upload Capa Personalizada"
                    >
                      {uploadingCover ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ImagePlus className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleOpenGallery}
                      className="w-7 h-7 rounded-full bg-purple-500/30 hover:bg-purple-500/50 text-white backdrop-blur-sm"
                      title="Galeria"
                    >
                      <Images className="w-3.5 h-3.5" />
                    </Button>
                    {isAdmin && isPremiumBook && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReprocess}
                        disabled={reprocessing}
                        className="w-7 h-7 rounded-full bg-blue-500/30 hover:bg-blue-500/50 text-white backdrop-blur-sm"
                        title="Reprocessar"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${reprocessing ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDelete}
                      className="w-7 h-7 rounded-full bg-red-500/30 hover:bg-red-500/50 text-white backdrop-blur-sm"
                      title="Deletar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-white text-lg font-bold mb-1 line-clamp-2 drop-shadow-lg">
                    {book.title}
                  </h3>
                  <p className="text-white/80 text-xs drop-shadow">{book.author || "Autor Desconhecido"}</p>
                  
                  {/* Progress badge */}
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-xs font-semibold">{book.progress}% lido</span>
                  </div>
                </div>
              </div>

              {/* Progress bar at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${book.progress}%` }}
                  transition={{ delay: index * 0.05 + 0.2, duration: 0.6 }}
                  className="h-full bg-gradient-to-r from-primary to-accent shadow-lg"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Select Cover Page Dialog */}
      <SelectCoverPageDialog
        open={showSelectPage}
        onOpenChange={setShowSelectPage}
        onSelectPage={handleSelectCoverPage}
        bookTitle={book.title}
        fileUrl={book.file_url}
        totalPages={book.total_pages}
        isLoading={generatingCover}
      />

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
    </>
  );
};

export default BookCard;