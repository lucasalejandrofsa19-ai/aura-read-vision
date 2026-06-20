import { useState, useEffect, useCallback, useId } from "react";
import { useInvalidateUserProfile } from "@/hooks/useInvalidateUserProfile";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useMobileOptimization } from "@/hooks/useMobileOptimization";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Bookmark,
 FileText,
 ExternalLink,
  Share2,
  BookmarkCheck,
  Maximize,
  Eye,
  MoreVertical,
  Highlighter,
  List,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PDFViewer } from "@/components/PDFViewer";
import { PresentationMode } from "@/components/PresentationMode";
import { FocusedReaderMode } from "@/components/FocusedReaderMode";
import { ThemeSelector } from "@/components/ThemeSelector";
import { NotesPanel } from "@/components/NotesPanel";
import { ExportDialog } from "@/components/ExportDialog";
import { FloatingControls } from "@/components/FloatingControls";
import { AudiobookPlayer } from "@/components/AudiobookPlayer";
import { ToolHelpTooltip } from "@/components/ToolHelpTooltip";
import { TOOL_COPY } from "@/lib/toolGuide";
import { TourTargetsProvider, useTourTarget } from "@/contexts/TourTargetsContext";
import { ReaderTour } from "@/components/ReaderTour";
import { ReaderBookSearch } from "@/components/ReaderBookSearch";

import { useFullscreen } from "@/hooks/useFullscreen";
import { useNotes } from "@/hooks/useNotes";
import { useAuth } from "@/contexts/AuthContext";

import { useReadingSession } from "@/hooks/useReadingSession";
import { useHighlights } from "@/hooks/useHighlights";
import { HighlightsList } from "@/components/HighlightsList";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { captureError } from "@/lib/sentry";
import { SEO } from "@/components/SEO";
import { AdSenseUnit } from "@/components/AdSenseUnit";
import { ADSENSE_SLOTS } from "@/lib/adsense";
import { PUBLIC_PDFS_LABEL, PUBLIC_PDFS_TOOLTIP, PUBLIC_PDFS_DESCRIPTION } from "@/lib/publicPdfs";

const Reader = () => {
  const publicPdfsDescId = useId();
  const { id } = useParams();
  const navigate = useNavigate();
  const [bookmarkedPage, setBookmarkedPage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [loadError, setLoadError] = useState<string>("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isFocusedMode, setIsFocusedMode] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [scale, setScale] = useState(1.0);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState<string>(() => {
    if (typeof window === "undefined") return "#fef08a";
    return localStorage.getItem("aura_highlight_color") || "#fef08a";
  });
  const [penThickness, setPenThickness] = useState<number>(() => {
    if (typeof window === "undefined") return 20;
    const v = Number(localStorage.getItem("aura_pen_thickness"));
    return Number.isFinite(v) && v >= 8 && v <= 40 ? v : 20;
  });
  useEffect(() => {
    localStorage.setItem("aura_highlight_color", highlightColor);
  }, [highlightColor]);
  useEffect(() => {
    localStorage.setItem("aura_pen_thickness", String(penThickness));
  }, [penThickness]);
  const [spokenText, setSpokenText] = useState('');
  const mobileConfig = useMobileOptimization();
  const highlightTargetRef = useTourTarget("reader-highlight");
  const aiSummaryTargetRef = useTourTarget("reader-ai-summary");
  const shareTargetRef = useTourTarget("reader-share");

  const { highlights, allHighlights, addHighlight, deleteHighlight } = useHighlights(id || "", currentPage);

  const {
    notes,
    addNote: addNoteOriginal,
    updateNote,
    deleteNote: deleteNoteOriginal,
  } = useNotes(id || "");

  const addNote = async (pageNumber: number, noteText: string) => {
    return await addNoteOriginal(pageNumber, noteText);
  };

  const deleteNote = async (noteId: string) => {
    return await deleteNoteOriginal(noteId);
  };

  const { enterFullscreen } = useFullscreen();
  const { user } = useAuth();
  const invalidateProfile = useInvalidateUserProfile();
  const { startSession, endSession, updateSession, isSessionActive } = useReadingSession(id || "");

  useEffect(() => {
    loadBook();
  }, [id]);

  useEffect(() => {
    if (book && currentPage && !isSessionActive) {
      startSession(currentPage);
    }
  }, [book]);

  useEffect(() => {
    return () => {
      if (isSessionActive && currentPage) {
        endSession(currentPage);
      }
    };
  }, [isSessionActive, currentPage]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`book-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'books',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newPage = payload.new.current_page;
          if (newPage && newPage !== currentPage) {
            setCurrentPage(newPage);
            toast.success(`Posição sincronizada: página ${newPage}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, currentPage]);

  const loadBook = async () => {
    if (!id) {
      console.error("[Reader] No book ID provided");
      setLoadError("ID do livro ausente na URL.");
      setLoading(false);
      return;
    }
    setLoadError("");
    setPermissionDenied(false);
    setPdfUrl("");


    try {
      // Tenta primeiro nos livros do usuário
      let { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      let isPremium = false;
      let bucket = "pdfs";
      let isFree = false;

      // Se não achou, tenta nos premium (inclui livros gratuitos como a Bíblia)
      if (!data) {
        const { data: premiumData, error: premiumError } = await supabase
          .from("premium_books")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (premiumError) throw premiumError;
        if (!premiumData) throw error ?? new Error("Livro não encontrado");
        data = premiumData as any;
        isPremium = true;
        bucket = "premium-pdfs";
        isFree = !!(premiumData as any).is_free;
      } else if (error) {
        throw error;
      }

      setBook({ ...(data as any), __isPremium: isPremium, __bucket: bucket });

      // Pré-verificação de permissão para livros premium pagos
      if (isPremium && !isFree) {
        if (!user?.id) {
          setPermissionDenied(true);
          setLoading(false);
          return;
        }
        const { data: hasAccess } = await supabase.rpc("has_premium_access", {
          _user_id: user.id,
        });
        if (!hasAccess) {
          setPermissionDenied(true);
          setLoading(false);
          return;
        }
      }

      if ((data as any).current_page) {
        setCurrentPage((data as any).current_page);
      }

      const filePath = (data as any)?.file_path;
      if (filePath && typeof filePath === "string" && filePath.trim().length > 0) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60);

        if (signedError) throw signedError;
        if (!signedData?.signedUrl) throw new Error("URL assinada vazia retornada pelo storage");
        setPdfUrl(signedData.signedUrl);
      } else {
        console.error("[Reader] file_path ausente/vazio:", { id, bucket, isPremium, data });
        throw new Error(`Arquivo PDF não encontrado para este livro (bucket: ${bucket}). O registro existe mas não possui caminho de arquivo válido.`);
      }
    } catch (error: any) {
      console.error("[Reader] Error loading book:", error);
      captureError(error, { context: "load_book", bookId: id });
      const msg = error?.message || error?.error_description || "Erro desconhecido ao carregar PDF";
      const isPermissionError = /permission denied|not authorized|403|row-level security/i.test(msg);
      if (isPermissionError) {
        setPermissionDenied(true);
      } else {
        setLoadError(msg);
        toast.error(`Não foi possível abrir o PDF: ${msg}`, { duration: 8000 });
      }
    } finally {
      setLoading(false);
    }
  };


  const renewSignedUrl = useCallback(async (): Promise<string | null> => {
    const filePath = (book as any)?.file_path;
    const bucket = (book as any)?.__bucket ?? "pdfs";
    if (!filePath) return null;
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60);
      if (error || !data?.signedUrl) {
        console.error("[Reader] Falha ao renovar URL assinada:", error);
        return null;
      }
      setPdfUrl(data.signedUrl);
      return data.signedUrl;
    } catch (e) {
      console.error("[Reader] Exceção ao renovar URL assinada:", e);
      return null;
    }
  }, [book]);

  // Renovação proativa: refresh 5 min antes do TTL de 60 min
  useEffect(() => {
    if (!pdfUrl) return;
    const TTL_MS = 60 * 60 * 1000; // 1h (igual ao createSignedUrl)
    const REFRESH_BEFORE_MS = 5 * 60 * 1000; // 5 min de folga
    const intervalMs = TTL_MS - REFRESH_BEFORE_MS;
    const id = setInterval(() => {
      console.info("[Reader] Renovando URL assinada proativamente...");
      renewSignedUrl();
    }, intervalMs);
    return () => clearInterval(id);
  }, [pdfUrl, renewSignedUrl]);



  const saveCurrentPage = async (page: number) => {
    if (!id) return;
    // Não salvar progresso para livros premium/gratuitos compartilhados
    if ((book as any)?.__isPremium) return;

    try {
      const progress = book?.total_pages 
        ? Math.round((page / book.total_pages) * 100)
        : 0;

      const { error } = await supabase
        .from("books")
        .update({ 
          current_page: page,
          progress: progress 
        })
        .eq("id", id);
      
      if (error) throw error;
    } catch (error) {
      captureError(error, { context: "save_current_page" });
    }
  };

  const handleBookmark = () => {
    if (bookmarkedPage === currentPage) {
      setBookmarkedPage(null);
      toast.success("Marcador removido");
    } else {
      setBookmarkedPage(currentPage);
      toast.success(`Página ${currentPage} marcada!`);
    }
  };

  const goToBookmark = () => {
    if (bookmarkedPage) {
      setCurrentPage(bookmarkedPage);
      saveCurrentPage(bookmarkedPage);
      toast.success(`Indo para página marcada: ${bookmarkedPage}`);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    saveCurrentPage(page);
    setSelectedText("");
    
    if (isSessionActive) {
      updateSession(page);
    }
  };

  const handleTextSelect = (text: string) => {
    setSelectedText(text);
  };

  const handleNavigateToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    saveCurrentPage(pageNumber);
  };

  const handleEnterPresentationMode = async () => {
    setIsPresentationMode(true);
    
    try {
      const fullscreenSuccess = await enterFullscreen();
      if (fullscreenSuccess) {
        toast.success("Modo apresentação ativado");
      } else {
        toast.success("Modo apresentação ativado");
      }
    } catch (error) {
      console.error("Erro ao ativar fullscreen:", error);
      toast.success("Modo apresentação ativado");
    }
  };

  const handleExitPresentationMode = () => {
    setIsPresentationMode(false);
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const handleEnterFocusedMode = () => {
    setIsFocusedMode(true);
    toast.success("Modo leitura focada ativado");
  };

  const handleExitFocusedMode = () => {
    setIsFocusedMode(false);
  };

  const handleHighlightDrawn = async (data: { x: number; y: number; width: number; height: number; text: string; color: string }) => {
    const { text, color, ...coords } = data;
    return await addHighlight(coords, text, color);
  };

  const HIGHLIGHT_COLORS: Array<{ value: string; label: string }> = [
    { value: "#fef08a", label: "Amarelo" },
    { value: "#86efac", label: "Verde" },
    { value: "#93c5fd", label: "Azul" },
    { value: "#f9a8d4", label: "Rosa" },
    { value: "#fdba74", label: "Laranja" },
  ];

  const penToolbar = isDrawingMode ? (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 backdrop-blur px-2 py-1 shadow-sm">
      <div className="flex items-center gap-1">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setHighlightColor(c.value)}
            title={c.label}
            aria-label={`Cor ${c.label}`}
            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
              highlightColor === c.value ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "ring-1 ring-border"
            }`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
        <span className="text-xs text-muted-foreground">Espessura</span>
        <input
          type="range"
          min={8}
          max={40}
          step={2}
          value={penThickness}
          onChange={(e) => setPenThickness(Number(e.target.value))}
          className="w-20 accent-primary"
          aria-label="Espessura da caneta"
        />
        <span className="text-xs w-6 text-foreground">{penThickness}</span>
      </div>
    </div>
  ) : null;

  const seoTitle = book?.title ? `${book.title} — Leitor AURA READ` : "Leitor — AURA READ";
  const seoDesc = book?.title
    ? `Leia ${book.title} no leitor interativo da AURA READ com marca-texto inteligente, anotações e resumos.`
    : "Leitor de PDF interativo com marca-texto, anotações e resumos automáticos.";

  if (loading) {
    return (
      <>
        <SEO title={seoTitle} description={seoDesc} path={`/reader/${id ?? ""}`} noindex />
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (!book) return null;

  if (isFocusedMode && pdfUrl) {
    return (
      <FocusedReaderMode
        fileUrl={pdfUrl}
        initialPage={currentPage}
        totalPages={book.total_pages || 1}
        bookTitle={book.title}
        onClose={handleExitFocusedMode}
        onPageChange={handlePageChange}
        highlights={highlights.map(h => ({
          x: h.position_data.x,
          y: h.position_data.y,
          width: h.position_data.width,
          height: h.position_data.height,
          color: h.color,
        }))}
        onHighlightDrawn={handleHighlightDrawn}
        isDrawingMode={isDrawingMode}
        onDrawingModeChange={setIsDrawingMode}
        highlightColor={highlightColor}
        penThickness={penThickness}
      />
    );
  }

  if (isPresentationMode && pdfUrl) {
    return (
      <PresentationMode
        fileUrl={pdfUrl}
        initialPage={currentPage}
        bookTitle={book.title}
        onClose={handleExitPresentationMode}
        onPageChange={(page) => {
          setCurrentPage(page);
          handlePageChange(page);
        }}
      />
    );
  }

  const MotionHeader = mobileConfig.shouldReduceAnimations ? 'header' : motion.header;
  const MotionMain = mobileConfig.shouldReduceAnimations ? 'main' : motion.main;
  const headerProps = mobileConfig.shouldReduceAnimations 
    ? {} 
    : { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 } };
  const mainProps = mobileConfig.shouldReduceAnimations
    ? {}
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.2 } };

  return (
    <div className="min-h-screen bg-background transition-colors duration-500">
      <MotionHeader
        {...headerProps}
        className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-xl shadow-sm shadow-background/40"
      >
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-3 lg:py-4">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/library")}
              className="rounded-xl hover:bg-primary/10 hover:text-primary"
             aria-label="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-semibold tracking-tight truncate text-base lg:text-lg">{book.title}</h1>
              <p className="text-xs text-muted-foreground truncate">{book.author || "Autor desconhecido"}</p>
            </div>
            <ReaderBookSearch />
          </div>

          <div className="flex md:hidden items-center gap-2 ml-14 flex-wrap">
            <NotesPanel
              notes={notes}
              currentPage={currentPage}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
              onNavigateToPage={handleNavigateToPage}
            />

            <ExportDialog
              bookTitle={book.title}
              highlights={[]}
              notes={notes}
            />

            <ToolHelpTooltip {...TOOL_COPY.highlight}>
              <Button
                variant={isDrawingMode ? "default" : "ghost"}
                size="icon"
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className="aura-soft transition-aura"
                aria-label="Marcador de texto">
                <Highlighter className="w-5 h-5" style={{ color: isDrawingMode ? highlightColor : undefined }} />
              </Button>
            </ToolHelpTooltip>
            {penToolbar}

            <Sheet>
              <ToolHelpTooltip {...TOOL_COPY.highlightsList}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="aura-soft transition-aura"
                    aria-label="Lista de destaques">
                    <List className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
              </ToolHelpTooltip>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Destaques</SheetTitle>
                  <SheetDescription>
                    {allHighlights.length} destaque{allHighlights.length !== 1 ? "s" : ""} neste livro
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <HighlightsList
                    highlights={allHighlights}
                    currentPage={currentPage}
                    onDelete={(highlightId) => {
                      deleteHighlight(highlightId);
                    }}
                    onNavigate={(pageNumber) => {
                      handlePageChange(pageNumber);
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <ToolHelpTooltip {...TOOL_COPY.bookmark}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`transition-aura ${bookmarkedPage ? "text-accent aura-amber" : "aura-soft"}`}
                    aria-label="Página marcada">
                    {bookmarkedPage ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                  </Button>
                </DropdownMenuTrigger>
              </ToolHelpTooltip>
              <DropdownMenuContent align="start" className="glass">
                <DropdownMenuItem onClick={handleBookmark}>
                  {bookmarkedPage === currentPage ? "Remover marcador" : "Marcar página atual"}
                </DropdownMenuItem>
                {bookmarkedPage && bookmarkedPage !== currentPage && (
                  <DropdownMenuItem onClick={goToBookmark}>
                    Ir para página {bookmarkedPage}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="aura-soft transition-aura"
                  title="Mais opções"
                 aria-label="Mais opções">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass w-56">
                <DropdownMenuItem onClick={handleEnterFocusedMode}>
                  <Eye className="w-4 h-4 mr-2" />
                  Modo Leitura Focada
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleEnterPresentationMode}>
                  <Maximize className="w-4 h-4 mr-2" />
                  Modo Apresentação
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/summary/" + id)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Ver Resumo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/share/" + id)}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Compartilhar
                </DropdownMenuItem>
                <DropdownMenuItem title={PUBLIC_PDFS_TOOLTIP} aria-label={PUBLIC_PDFS_TOOLTIP} aria-describedby={publicPdfsDescId} onClick={() => window.open("/pdfs-publicos", "_blank", "noopener,noreferrer")}>
                  <FileText className="w-4 h-4 mr-2" />
                  {PUBLIC_PDFS_LABEL}
                  <ExternalLink className="w-3 h-3 ml-auto opacity-60" aria-hidden="true" />
                  <span id={publicPdfsDescId} className="sr-only">{PUBLIC_PDFS_DESCRIPTION}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    if (!user) return;
                    await supabase
                      .from("profiles")
                      .update({ has_seen_reader_tour: false })
                      .eq("id", user.id);
                    await invalidateProfile();
                    window.dispatchEvent(new CustomEvent("reader-tour:restart"));
                  }}
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Rever tour
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ThemeSelector />

            <AudiobookPlayer
              bookId={id || ""}
              pdfUrl={pdfUrl}
              extractedText={book.extracted_text}
              totalPages={book.total_pages || 1}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              bookTitle={book.title}
              onSpokenTextChange={setSpokenText}
            />
          </div>

          <div className="hidden md:flex items-center gap-2 flex-wrap ml-14">
            <ThemeSelector />

            <ExportDialog
              bookTitle={book.title}
              highlights={[]}
              notes={notes}
            />

            <div className="lg:hidden">
              <NotesPanel
                notes={notes}
                currentPage={currentPage}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
                onNavigateToPage={handleNavigateToPage}
              />
            </div>

            <ToolHelpTooltip {...TOOL_COPY.highlight}>
              <Button
                ref={highlightTargetRef}
                variant={isDrawingMode ? "default" : "ghost"}
                size="icon"
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className="aura-soft transition-aura"
                aria-label="Marcador de texto">
                <Highlighter className="w-5 h-5" style={{ color: isDrawingMode ? highlightColor : undefined }} />
              </Button>
            </ToolHelpTooltip>
            {penToolbar}

            <div className="lg:hidden">
              <Sheet>
                <ToolHelpTooltip {...TOOL_COPY.highlightsList}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="aura-soft transition-aura"
                      aria-label="Lista de destaques">
                      <List className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                </ToolHelpTooltip>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Destaques</SheetTitle>
                    <SheetDescription>
                      {allHighlights.length} destaque{allHighlights.length !== 1 ? "s" : ""} neste livro
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <HighlightsList
                      highlights={allHighlights}
                      currentPage={currentPage}
                      onDelete={(highlightId) => {
                        deleteHighlight(highlightId);
                      }}
                      onNavigate={(pageNumber) => {
                        handlePageChange(pageNumber);
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>



            <DropdownMenu>
              <ToolHelpTooltip {...TOOL_COPY.bookmark}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`transition-aura ${bookmarkedPage ? "text-accent aura-amber" : "aura-soft"}`}
                    aria-label="Página marcada">
                    {bookmarkedPage ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                  </Button>
                </DropdownMenuTrigger>
              </ToolHelpTooltip>
              <DropdownMenuContent align="start" className="glass">
                <DropdownMenuItem onClick={handleBookmark}>
                  {bookmarkedPage === currentPage ? "Remover marcador" : "Marcar página atual"}
                </DropdownMenuItem>
                {bookmarkedPage && bookmarkedPage !== currentPage && (
                  <DropdownMenuItem onClick={goToBookmark}>
                    Ir para página {bookmarkedPage}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolHelpTooltip {...TOOL_COPY.aiSummary}>
              <Button
                ref={aiSummaryTargetRef}
                variant="ghost"
                size="icon"
                onClick={() => navigate("/summary/" + id)}
                className="aura-soft transition-aura relative"
                aria-label="Resumir tudo com IA">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-primary text-primary-foreground rounded-full px-1 leading-tight">IA</span>
              </Button>
            </ToolHelpTooltip>

            <ToolHelpTooltip {...TOOL_COPY.share}>
              <Button
                ref={shareTargetRef}
                variant="ghost"
                size="icon"
                onClick={() => navigate("/share/" + id)}
                className="aura-soft transition-aura"
                aria-label="Compartilhar">
                <Share2 className="w-5 h-5" />
              </Button>
            </ToolHelpTooltip>

            <ToolHelpTooltip {...TOOL_COPY.focusedReader}>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEnterFocusedMode}
                className="aura-soft transition-aura"
                aria-label="Modo leitura focada">
                <Eye className="w-5 h-5" />
              </Button>
            </ToolHelpTooltip>

            <ToolHelpTooltip {...TOOL_COPY.presentation}>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEnterPresentationMode}
                className="aura-soft transition-aura"
                aria-label="Modo apresentação">
                <Maximize className="w-5 h-5" />
              </Button>
            </ToolHelpTooltip>

            <AudiobookPlayer
              bookId={id || ""}
              pdfUrl={pdfUrl}
              extractedText={book.extracted_text}
              totalPages={book.total_pages || 1}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              bookTitle={book.title}
              onSpokenTextChange={setSpokenText}
            />
          </div>
        </div>
      </MotionHeader>

      <MotionMain
        {...mainProps}
        className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-12 py-6 lg:py-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-6">
          {/* Left rail (desktop) */}
          <aside className="hidden lg:flex lg:col-span-3 xl:col-span-3 flex-col gap-4 lg:sticky lg:top-32 lg:self-start lg:max-h-[calc(100vh-9rem)] overflow-y-auto scrollbar-hide">
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm shadow-background/40">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Progresso</p>
              <div className="text-3xl font-display font-bold tabular-nums">{currentPage}</div>
              <p className="text-xs text-muted-foreground">de {book.total_pages || "—"} páginas</p>
              <div className="mt-3 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((currentPage / Math.max(1, book.total_pages || 1)) * 100))}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm shadow-background/40">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Anotações</p>
                <span className="text-xs font-display font-bold tabular-nums">{notes.length}</span>
              </div>
              <NotesPanel
                inline
                notes={notes}
                currentPage={currentPage}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
                onNavigateToPage={handleNavigateToPage}
              />
            </div>
          </aside>

          {/* Center: PDF */}
          <div className="lg:col-span-6 xl:col-span-6 space-y-4">
            <AdSenseUnit slot={ADSENSE_SLOTS.libraryTop} format="auto" />
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-lg shadow-background/40 overflow-hidden">
              {pdfUrl ? (
                <PDFViewer
                  fileUrl={pdfUrl}
                  onRenewUrl={renewSignedUrl}
                  initialPage={currentPage}
                  onPageChange={handlePageChange}
                  onTextSelect={handleTextSelect}
                  externalScale={scale}
                  onScaleChange={setScale}
                  highlights={highlights.map(h => ({
                    x: h.position_data.x,
                    y: h.position_data.y,
                    width: h.position_data.width,
                    height: h.position_data.height,
                    color: h.color,
                  }))}
                  onHighlightDrawn={handleHighlightDrawn}
                  isDrawingMode={isDrawingMode}
                  highlightColor={highlightColor}
                  penThickness={penThickness}
                  spokenText={spokenText}
                  bookmarkIndicator={
                    bookmarkedPage === currentPage && !mobileConfig.shouldReduceAnimations ? (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-accent/90 backdrop-blur text-accent-foreground px-6 py-3 rounded-full shadow-xl border-2 border-accent flex items-center gap-3 font-semibold"
                      >
                        <BookmarkCheck className="w-6 h-6" />
                        <span className="text-base">Página marcada</span>
                      </motion.div>
                    ) : bookmarkedPage === currentPage ? (
                      <div className="bg-accent/90 backdrop-blur text-accent-foreground px-6 py-3 rounded-full shadow-xl border-2 border-accent flex items-center gap-3 font-semibold">
                        <BookmarkCheck className="w-6 h-6" />
                        <span className="text-base">Página marcada</span>
                      </div>
                    ) : null
                  }
                />
              ) : (
                <div className="text-center py-12 px-6 space-y-4">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {loading ? "Carregando PDF..." : "Não foi possível abrir o PDF"}
                    </p>
                    {!loading && loadError && (
                      <p className="text-sm text-destructive mt-2 break-words">{loadError}</p>
                    )}
                    {!loading && !loadError && (
                      <p className="text-sm text-muted-foreground mt-2">
                        O PDF ainda não foi carregado. Tente novamente; se o problema persistir, o arquivo pode ter sido removido do armazenamento.
                      </p>
                    )}

                    {!loading && (
                      <div className="mt-4 mx-auto max-w-xl rounded-lg border border-border/60 bg-muted/40 p-3 text-left text-xs font-mono space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-sans">Diagnóstico</p>
                        <div className="break-all"><span className="text-muted-foreground">book.id:</span> {id || "—"}</div>
                        <div className="break-all"><span className="text-muted-foreground">bucket:</span> {(book as any)?.__bucket || "—"}</div>
                        <div className="break-all"><span className="text-muted-foreground">file_path:</span> {(book as any)?.file_path || "—"}</div>
                        <div className="break-all"><span className="text-muted-foreground">premium:</span> {String(!!(book as any)?.__isPremium)}</div>
                        <div className="break-all"><span className="text-muted-foreground">error:</span> <span className="text-destructive">{loadError || "(nenhum)"}</span></div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] mt-1"
                          onClick={() => {
                            const payload = `book.id: ${id}\nbucket: ${(book as any)?.__bucket}\nfile_path: ${(book as any)?.file_path}\npremium: ${!!(book as any)?.__isPremium}\nerror: ${loadError}`;
                            navigator.clipboard?.writeText(payload);
                            toast.success("Diagnóstico copiado");
                          }}
                        >
                          Copiar diagnóstico
                        </Button>
                      </div>
                    )}
                  </div>

                  {!loading && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setLoading(true); loadBook(); }}>
                        Tentar novamente
                      </Button>
                      <Button size="sm" onClick={() => navigate("/library")}>
                        Voltar à biblioteca
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right rail (desktop) — HighlightsList inline */}
          <aside className="hidden lg:flex lg:col-span-3 xl:col-span-3 flex-col gap-4 lg:sticky lg:top-32 lg:self-start lg:max-h-[calc(100vh-9rem)]">
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm shadow-background/40 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Destaques</p>
                <span className="text-xs font-display font-bold tabular-nums">{allHighlights.length}</span>
              </div>
              <div className="flex-1 min-h-0 -mx-2">
                <HighlightsList
                  highlights={allHighlights}
                  currentPage={currentPage}
                  onDelete={(highlightId) => deleteHighlight(highlightId)}
                  onNavigate={(pageNumber) => handlePageChange(pageNumber)}
                />
              </div>
            </div>
          </aside>
        </div>
      </MotionMain>


      <FloatingControls
        onZoomIn={() => {
          setScale(prev => {
            const newScale = Math.min(prev + 0.2, 3.0);
            return newScale;
          });
        }}
        onZoomOut={() => {
          setScale(prev => {
            const newScale = Math.max(prev - 0.2, 0.5);
            return newScale;
          });
        }}
        onBookmark={handleBookmark}
        onPrevPage={() => {
          const newPage = Math.max(currentPage - 1, 1);
          handlePageChange(newPage);
        }}
        onNextPage={() => {
          const newPage = Math.min(currentPage + 1, book.total_pages || 1);
          handlePageChange(newPage);
        }}
        onSearch={() => setShowSearch(true)}
        isBookmarked={bookmarkedPage === currentPage}
        canZoomIn={scale < 3.0}
        canZoomOut={scale > 0.5}
        canGoPrev={currentPage > 1}
        canGoNext={currentPage < (book.total_pages || 1)}
        currentPage={currentPage}
        totalPages={book.total_pages || 1}
      />

    </div>
  );
};

const ReaderWithTour = () => (
  <TourTargetsProvider>
    <Reader />
    <ReaderTour />
  </TourTargetsProvider>
);

export default ReaderWithTour;