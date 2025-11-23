import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Bookmark,
  FileText,
  Share2,
  BookmarkCheck,
  Maximize,
  Eye,
  Volume2,
  FileDown,
  StickyNote,
  Palette,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PDFViewer } from "@/components/PDFViewer";
import { HighlightToolbar } from "@/components/HighlightToolbar";
import { HighlightsList } from "@/components/HighlightsList";
import { PresentationMode } from "@/components/PresentationMode";
import { FocusedReaderMode } from "@/components/FocusedReaderMode";
import { ThemeSelector } from "@/components/ThemeSelector";
import { TextToSpeechControls } from "@/components/TextToSpeechControls";
import { NotesPanel } from "@/components/NotesPanel";
import { ExportDialog } from "@/components/ExportDialog";
import { PremiumActionButton } from "@/components/PremiumActionButton";
import { FloatingControls } from "@/components/FloatingControls";
import { useHighlights } from "@/hooks/useHighlights";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useNotes } from "@/hooks/useNotes";
import { useAuth } from "@/contexts/AuthContext";
import { usePremiumAccessCache } from "@/hooks/usePremiumAccessCache";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { captureError } from "@/lib/sentry";


const Reader = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bookmarkedPage, setBookmarkedPage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [selectedText, setSelectedText] = useState("");
  const [highlightColor, setHighlightColor] = useState("#fef08a");
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isFocusedMode, setIsFocusedMode] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [scale, setScale] = useState(1.0);

  const {
    highlights,
    addHighlight,
    deleteHighlight,
    getHighlightsForPage,
  } = useHighlights(id || "");

  const {
    notes,
    addNote: addNoteOriginal,
    updateNote,
    deleteNote: deleteNoteOriginal,
  } = useNotes(id || "");

  // Wrapper functions to play sounds
  const addNote = async (pageNumber: number, noteText: string) => {
    const result = await addNoteOriginal(pageNumber, noteText);
    if (result) {
      playSound('note');
    }
    return result;
  };

  const deleteNote = async (noteId: string) => {
    const success = await deleteNoteOriginal(noteId);
    if (success) {
      playSound('delete');
    }
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    const success = await deleteHighlight(highlightId);
    if (success) {
      playSound('delete');
    }
  };

  const { enterFullscreen } = useFullscreen();
  const { subscriptionTier, user } = useAuth();
  const { verifyPremiumAccess } = usePremiumAccessCache();
  const { playSound } = useSoundEffects();
  
  const {
    speak,
    stop,
    togglePause,
    isSpeaking,
    isPaused,
    voices,
    selectedVoice,
    setSelectedVoice,
    rate,
    setRate,
    pitch,
    setPitch,
  } = useTextToSpeech();

  useEffect(() => {
    loadBook();
  }, [id]);

  // Realtime sync for reading position
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
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setBook(data);
      
      // Set current page from database
      if (data.current_page) {
        setCurrentPage(data.current_page);
      }

      // Get public URL for the PDF
      if (data.file_path) {
        const { data: urlData } = supabase.storage
          .from("pdfs")
          .getPublicUrl(data.file_path);
        
        setPdfUrl(urlData.publicUrl);
      }
    } catch (error) {
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
      const { error } = await supabase
        .from("books")
        .update({ current_page: page })
        .eq("id", id);
      
      if (error) throw error;
    } catch (error) {
      captureError(error, { context: "save_current_page" });
    }
  };

  const handleBookmark = () => {
    if (bookmarkedPage === currentPage) {
      // Remove bookmark
      setBookmarkedPage(null);
      playSound('delete');
      toast.success("Marcador removido");
    } else {
      // Set bookmark to current page
      setBookmarkedPage(currentPage);
      playSound('bookmark');
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
    setSelectedText(""); // Clear selection when changing pages
    playSound('page-turn');
  };

  const handleTextSelect = (text: string) => {
    setSelectedText(text);
  };

  const handleAddHighlight = async () => {
    if (!selectedText) {
      toast.error("Selecione um texto primeiro");
      return;
    }

    await addHighlight(currentPage, selectedText, highlightColor);
    playSound('highlight');
    setSelectedText("");
    window.getSelection()?.removeAllRanges();
  };

  const handleNavigateToHighlight = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    saveCurrentPage(pageNumber);
  };

  const handleEnterPresentationMode = async () => {
    await enterFullscreen();
    setIsPresentationMode(true);
    toast.success("Modo apresentação ativado");
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

  const handleReadAloud = async () => {
    if (!user) {
      toast.error("Faça login para usar este recurso");
      return;
    }

    // Server-side validation - never trust client-side cache for operations
    try {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const userRoles = (roles || []).map(r => r.role);
      const hasPremiumAccess = userRoles.includes('admin') || userRoles.includes('premium');

      if (!hasPremiumAccess) {
        toast.error("Recurso disponível apenas para assinantes Premium", {
          action: {
            label: "Assinar",
            onClick: () => navigate("/pricing"),
          },
        });
        return;
      }

      if (!book?.extracted_text) {
        toast.error("Texto não disponível para leitura");
        return;
      }

      const startIndex = book.current_page || 1;
      const textToRead = book.extracted_text
        .split(/Página \d+/)
        .slice(startIndex)
        .join(" ");

      if (textToRead.trim()) {
        speak(textToRead);
        playSound('page-turn');
      }
    } catch (error) {
      console.error('Error validating premium access:', error);
      toast.error("Erro ao validar acesso premium");
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+Shift+R to read aloud
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        handleReadAloud();
      }
      // Space to pause/resume
      if (e.code === 'Space' && isSpeaking) {
        e.preventDefault();
        togglePause();
      }
      // Escape to stop
      if (e.key === 'Escape' && isSpeaking) {
        e.preventDefault();
        stop();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isSpeaking, book]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!book) return null;

  // Focused Reading Mode
  if (isFocusedMode && pdfUrl) {
    return (
      <FocusedReaderMode
        fileUrl={pdfUrl}
        initialPage={currentPage}
        totalPages={book.total_pages || 1}
        bookTitle={book.title}
        onClose={handleExitFocusedMode}
        onPageChange={handlePageChange}
      />
    );
  }

  // Presentation Mode
  if (isPresentationMode && pdfUrl) {
    return (
      <PresentationMode
        fileUrl={pdfUrl}
        initialPage={currentPage}
        bookTitle={book.title}
        onClose={handleExitPresentationMode}
        onPageChange={handlePageChange}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-500">
      {/* Toolbar */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass sticky top-0 z-50 border-b border-border/50"
      >
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Linha 1: Botão voltar e título do livro */}
          <div className="flex items-center gap-4 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/library")}
              className="aura-soft transition-aura"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-semibold">{book.title}</h1>
              <p className="text-xs text-muted-foreground">{book.author || "Autor Desconhecido"}</p>
            </div>
          </div>

          {/* Mobile: Ícones essenciais + Menu "Mais opções" */}
          <div className="flex md:hidden items-center gap-2 ml-14 flex-wrap">
            <NotesPanel
              notes={notes}
              currentPage={currentPage}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
              onNavigateToPage={handleNavigateToHighlight}
            />

            <ExportDialog
              bookTitle={book.title}
              highlights={highlights}
              notes={notes}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`transition-aura ${bookmarkedPage ? "text-accent aura-amber" : "aura-soft"}`}
                  title="Marcador"
                >
                  {bookmarkedPage ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                </Button>
              </DropdownMenuTrigger>
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

            {/* Dropdown "Mais opções" para funções secundárias */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="aura-soft transition-aura"
                  title="Mais opções"
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass w-56">
                <DropdownMenuItem onClick={handleReadAloud}>
                  <Volume2 className="w-4 h-4 mr-2" />
                  Ler em voz alta
                </DropdownMenuItem>
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
          </div>

          {/* Desktop: Linha 2 com todos os ícones de função em fila */}
          <div className="hidden md:flex items-center gap-2 flex-wrap ml-14">
            <TextToSpeechControls
              isSpeaking={isSpeaking}
              isPaused={isPaused}
              onSpeak={handleReadAloud}
              onStop={stop}
              onTogglePause={togglePause}
              voices={voices}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              rate={rate}
              onRateChange={setRate}
              pitch={pitch}
              onPitchChange={setPitch}
            />

            <ThemeSelector />

            <ExportDialog
              bookTitle={book.title}
              highlights={highlights}
              notes={notes}
            />

            <NotesPanel
              notes={notes}
              currentPage={currentPage}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
              onNavigateToPage={handleNavigateToHighlight}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`transition-aura ${bookmarkedPage ? "text-accent aura-amber" : "aura-soft"}`}
                  title="Marcador"
                >
                  {bookmarkedPage ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                </Button>
              </DropdownMenuTrigger>
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

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/summary/" + id)}
              className="aura-soft transition-aura"
              title="Resumo"
            >
              <FileText className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/share/" + id)}
              className="aura-soft transition-aura"
              title="Compartilhar"
            >
              <Share2 className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleEnterFocusedMode}
              className="aura-soft transition-aura"
              title="Modo Leitura Focada"
            >
              <Eye className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleEnterPresentationMode}
              className="aura-soft transition-aura"
              title="Modo Apresentação"
            >
              <Maximize className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-5xl mx-auto px-6 py-12 space-y-6"
      >
        {/* Highlights List */}
        <HighlightsList
          highlights={highlights}
          onDelete={handleDeleteHighlight}
          onNavigate={handleNavigateToHighlight}
        />

        {/* Highlight Toolbar */}
        <HighlightToolbar
          selectedColor={highlightColor}
          onColorChange={setHighlightColor}
          onHighlight={handleAddHighlight}
          isHighlightMode={!!selectedText}
          selectedText={selectedText}
        />

        {pdfUrl ? (
            <PDFViewer 
              fileUrl={pdfUrl} 
              initialPage={currentPage}
              onPageChange={handlePageChange}
              onTextSelect={handleTextSelect}
              externalScale={scale}
              onScaleChange={setScale}
              bookmarkIndicator={
                bookmarkedPage === currentPage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-accent/90 backdrop-blur text-accent-foreground px-6 py-3 rounded-full shadow-xl border-2 border-accent flex items-center gap-3 font-semibold"
                  >
                    <BookmarkCheck className="w-6 h-6" />
                    <span className="text-base">Página marcada</span>
                  </motion.div>
                )
              }
            />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum arquivo PDF disponível</p>
          </div>
        )}
      </motion.main>

      {/* Floating Controls for Mobile */}
      <FloatingControls
        onZoomIn={() => setScale(prev => Math.min(prev + 0.2, 3.0))}
        onZoomOut={() => setScale(prev => Math.max(prev - 0.2, 0.5))}
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