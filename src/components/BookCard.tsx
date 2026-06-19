import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Trash2, RefreshCw, Images, ImagePlus, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getSignedStorageUrl } from "@/lib/storageUrl";
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

      // Persist bare path; signed URL is generated on read
      const table = isPremiumBook ? "premium_books" : "books";
      const { error: updateError } = await supabase
        .from(table)
        .update({ cover_image_url: fileName })
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

  const MAX_FALLBACK_RETRIES = 2;
  const fallbackRetriesRef = useRef(0);

  const handleSelectCoverPage = async (pageNumber: number, isRetry = false) => {
    if (!book.file_url) {
      toast.error("URL do PDF não disponível");
      return;
    }

    if (!isRetry) fallbackRetriesRef.current = 0;

    toast.loading("Gerando capa...", { id: "generate-cover" });

    try {
      const result = await generateCover(book.id, book.file_url, pageNumber);
      if (result?.fallback) {
        const canRetry = fallbackRetriesRef.current < MAX_FALLBACK_RETRIES;
        if (canRetry) {
          toast.warning(
            `Não foi possível verificar a capa — usando fallback (tentativa ${fallbackRetriesRef.current + 1}/${MAX_FALLBACK_RETRIES})`,
            {
              id: "generate-cover",
              duration: 10000,
              action: {
                label: "Tentar novamente",
                onClick: () => {
                  fallbackRetriesRef.current += 1;
                  void handleSelectCoverPage(pageNumber, true);
                },
              },
            }
          );
        } else {
          toast.info(
            "Limite de tentativas atingido. Tente gerar a capa novamente mais tarde.",
            { id: "generate-cover", duration: 10000 }
          );
          fallbackRetriesRef.current = 0;
        }
      }
      } else {
        fallbackRetriesRef.current = 0;
        toast.success("✨ Capa gerada com sucesso!", { id: "generate-cover" });
        setShowSelectPage(false);
      }
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
        const signed = await Promise.all(
          (images || []).map(async (img: any) => ({
            ...img,
            image_url: await getSignedStorageUrl("highlight-images", img.storage_path || img.image_url),
          }))
        );
        setGalleryImages(signed);
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
      {/* Premium book card */}
      <div className="relative">
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative"
        >
          {/* Glow on hover */}
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/40 via-accent/20 to-transparent opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300 pointer-events-none" />

          {/* Cover */}
          <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-card shadow-lg shadow-background/40 transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-primary/20">
            <div className={`relative aspect-[2/3] ${book.cover_image_url ? 'bg-muted' : `bg-gradient-to-br ${book.cover_color || 'from-primary to-secondary'}`} overflow-hidden`}>
              {book.cover_image_url ? (
                <LazyImage
                  src={book.cover_image_url}
                  alt={book.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  containerClassName="absolute inset-0"
                />
              ) : (
                <>
                  <div className="absolute inset-0 opacity-[0.08] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-primary-foreground/80 p-4">
                      <div className="w-10 h-10 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs font-medium">Gerando capa…</p>
                    </div>
                  </div>
                </>
              )}

              {/* Bottom gradient for legibility */}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />

              {/* Top action bar */}
              <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                <div className="p-1.5 rounded-lg bg-background/40 backdrop-blur-md border border-border/40">
                  <BookOpen className="w-4 h-4 text-foreground/90" />
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); setShowSelectPage(true); }}
                    disabled={generatingCover}
                    className="w-7 h-7 rounded-lg bg-background/70 hover:bg-background border border-border/40 text-foreground backdrop-blur-md"
                    title="Escolher página da capa"
                  >
                    {generatingCover ? (
                      <div className="w-3.5 h-3.5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileImage className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click(); }}
                    disabled={uploadingCover}
                    className="w-7 h-7 rounded-lg bg-background/70 hover:bg-background border border-border/40 text-foreground backdrop-blur-md"
                    title="Upload capa personalizada"
                  >
                    {uploadingCover ? (
                      <div className="w-3.5 h-3.5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ImagePlus className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleOpenGallery}
                    className="w-7 h-7 rounded-lg bg-background/70 hover:bg-background border border-border/40 text-foreground backdrop-blur-md"
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
                      className="w-7 h-7 rounded-lg bg-background/70 hover:bg-background border border-border/40 text-foreground backdrop-blur-md"
                      title="Reprocessar"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${reprocessing ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDelete}
                    className="w-7 h-7 rounded-lg bg-destructive/80 hover:bg-destructive border border-destructive/40 text-destructive-foreground backdrop-blur-md"
                    title="Deletar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Title + author + progress */}
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h3 className="text-foreground text-base font-display font-semibold leading-tight line-clamp-2 mb-1 tracking-tight">
                  {book.title}
                </h3>
                <p className="text-muted-foreground text-xs line-clamp-1 mb-3">
                  {book.author || "Autor desconhecido"}
                </p>

                {/* Progress */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${book.progress ?? 0}%` }}
                      transition={{ delay: index * 0.05 + 0.2, duration: 0.6 }}
                      className="h-full bg-gradient-to-r from-primary to-accent"
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                    {book.progress ?? 0}%
                  </span>
                </div>
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