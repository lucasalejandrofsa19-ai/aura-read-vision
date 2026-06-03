import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useMobileOptimization } from "@/hooks/useMobileOptimization";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Bookmark,
  FileText,
  Share2,
  BookmarkCheck,
  Maximize,
  Eye,
  MoreVertical,
  Highlighter,
  List,
  Sparkles,
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

const Reader = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bookmarkedPage, setBookmarkedPage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string>("");
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
      return;
    }

    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      setBook(data);
      
      if (data.current_page) {
        setCurrentPage(data.current_page);
      }

      if (data.file_path) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("pdfs")
          .createSignedUrl(data.file_path, 60 * 60); // 1 hour

        if (signedError) throw signedError;
        setPdfUrl(signedData?.signedUrl ?? "");
      }
    } catch (error) {
      console.error("[Reader] Error loading book:", error);
      captureError(error, { context: "load_book" });
      toast.error("Erro ao carregar livro");
      navigate("/library");
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentPage = async (page: number) => {
    if (!id) return;
    
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

  const handleHighlightDrawn = (data: { x: number; y: number; width: number; height: number; text: string; color: string }) => {
    const { text, color, ...coords } = data;
    addHighlight(coords, text, color);
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
        className="glass sticky top-0 z-50 border-b border-border/50"
      >
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center gap-4 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/library")}
              className="aura-soft transition-aura"
             aria-label="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-semibold">{book.title}</h1>
              <p className="text-xs text-muted-foreground">{book.author || "Autor Desconhecido"}</p>
            </div>
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

            <NotesPanel
              notes={notes}
              currentPage={currentPage}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
              onNavigateToPage={handleNavigateToPage}
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

            <ToolHelpTooltip {...TOOL_COPY.aiSummary}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/summary/" + id)}
                className="aura-soft transition-aura relative"
                aria-label="Resumir tudo com IA">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-primary text-primary-foreground rounded-full px-1 leading-tight">IA</span>
              </Button>
            </ToolHelpTooltip>

            <ToolHelpTooltip
              title="Compartilhar"
              description="Envie um link público do livro ou de destaques para outras pessoas."
              guideAnchor="Compartilhar"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/share/" + id)}
                className="aura-soft transition-aura"
                aria-label="Compartilhar">
                <Share2 className="w-5 h-5" />
              </Button>
            </ToolHelpTooltip>

            <ToolHelpTooltip
              title="Leitura focada"
              description="Esconde distrações e amplia a página para você focar só na leitura."
              guideAnchor="Leitor de PDF"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEnterFocusedMode}
                className="aura-soft transition-aura"
                aria-label="Modo leitura focada">
                <Eye className="w-5 h-5" />
              </Button>
            </ToolHelpTooltip>

            <ToolHelpTooltip
              title="Modo apresentação"
              description="Tela cheia com navegação e zoom — ideal para projeções e aulas."
              guideAnchor="Modo apresentação"
            >
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
        className="max-w-screen-2xl mx-auto px-4 lg:px-10 xl:px-16 py-8 lg:py-12 space-y-6"
      >
        <AdSenseUnit slot={ADSENSE_SLOTS.libraryTop} format="auto" className="mb-4" />
        {pdfUrl ? (
          <PDFViewer 
            fileUrl={pdfUrl} 
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
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum arquivo PDF disponível</p>
          </div>
        )}
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

export default Reader;