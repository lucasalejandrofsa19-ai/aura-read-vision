import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMobileOptimization } from "@/hooks/useMobileOptimization";
import { Document, Page, pdfjs } from "react-pdf";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Info,
  Highlighter,
  Image,
  Volume2,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HighlightCanvas } from "@/components/HighlightCanvas";
import { TextToSpeechControls } from "@/components/TextToSpeechControls";
import { HighlightImageDialog } from "@/components/HighlightImageDialog";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PresentationModeProps {
  fileUrl: string;
  initialPage?: number;
  bookTitle: string;
  onClose: () => void;
  onPageChange?: (page: number) => void;
  highlightCount?: number;
  onOpenHighlights?: () => void;
  highlights?: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  onHighlightAdded?: (highlight: { x: number; y: number; width: number; height: number }) => void;
  extractedText?: string;
}

export const PresentationMode = ({
  fileUrl,
  initialPage = 1,
  bookTitle,
  onClose,
  onPageChange,
  highlightCount = 0,
  onOpenHighlights,
  highlights = [],
  onHighlightAdded,
  extractedText = "",
}: PresentationModeProps) => {
  const mobileConfig = useMobileOptimization();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(mobileConfig.isMobile ? 1.0 : 1.2);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState("#fef08a");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [zoomSensitivity, setZoomSensitivity] = useState(1.0);
  const hideControlsTimeout = useState<NodeJS.Timeout | null>(null)[1];
  const { user } = useAuth();
  
  // Paleta de cores para destaques
  const highlightColors = [
    { color: "#fef08a", name: "Amarelo" },
    { color: "#86efac", name: "Verde" },
    { color: "#93c5fd", name: "Azul" },
    { color: "#fda4af", name: "Rosa" },
    { color: "#fbbf24", name: "Laranja" },
    { color: "#c4b5fd", name: "Roxo" },
    { color: "#fb923c", name: "Coral" },
    { color: "#67e8f9", name: "Ciano" },
  ];
  
  // Load zoom sensitivity from profile
  useEffect(() => {
    const loadZoomSensitivity = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("zoom_sensitivity")
        .eq("id", user.id)
        .single();
      
      if (!error && data?.zoom_sensitivity) {
        setZoomSensitivity(data.zoom_sensitivity);
      }
    };
    
    loadZoomSensitivity();
  }, [user]);
  
  // Save zoom sensitivity to profile
  const handleZoomSensitivityChange = async (value: number) => {
    setZoomSensitivity(value);
    
    if (!user) return;
    
    await supabase
      .from("profiles")
      .update({ zoom_sensitivity: value })
      .eq("id", user.id);
  };
  
  // Text-to-speech
  const tts = useTextToSpeech();
  
  // Touch gesture support for pinch-to-zoom
  const touchStartRef = useRef<{ dist: number; scale: number } | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const goToPrevPage = useCallback(() => {
    if (pageNumber > 1) {
      const newPage = pageNumber - 1;
      setPageNumber(newPage);
      onPageChange?.(newPage);
    }
  }, [pageNumber, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (pageNumber < numPages) {
      const newPage = pageNumber + 1;
      setPageNumber(newPage);
      onPageChange?.(newPage);
    }
  }, [pageNumber, numPages, onPageChange]);

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  // Handle text-to-speech
  const handleSpeak = () => {
    if (extractedText) {
      tts.speak(extractedText);
    }
  };

  // Touch gesture handlers for pinch-to-zoom
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = { dist, scale };
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const rawRatio = dist / touchStartRef.current.dist;
      // Apply sensitivity: adjust the ratio based on sensitivity factor
      const ratio = 1 + (rawRatio - 1) * zoomSensitivity;
      const newScale = Math.min(Math.max(touchStartRef.current.scale * ratio, 0.5), 3.0);
      setScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // Add touch event listeners
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scale, zoomSensitivity]);

  // Swipe gestures
  useSwipeGesture({
    onSwipeLeft: goToNextPage,
    onSwipeRight: goToPrevPage,
    threshold: 75,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          goToPrevPage();
          break;
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          goToNextPage();
          break;
        case "Escape":
          e.preventDefault();
          if (isHighlightMode) {
            setIsHighlightMode(false);
          } else {
            onClose();
          }
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
          e.preventDefault();
          zoomOut();
          break;
        case "h":
        case "H":
          e.preventDefault();
          setIsHighlightMode((prev) => !prev);
          break;
        case "i":
        case "I":
          e.preventDefault();
          setShowInfo((prev) => !prev);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevPage, goToNextPage, onClose, isHighlightMode]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const resetTimeout = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    const handleMouseMove = () => resetTimeout();
    const handleTouchStart = () => resetTimeout();

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("touchstart", handleTouchStart);
    resetTimeout();

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center" style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      overflow: 'hidden'
    }}>
      {/* Top Controls */}
      {mobileConfig.shouldReduceAnimations ? (
        showControls && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-white font-semibold text-lg truncate max-w-md">
                  {bookTitle}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowInfo(!showInfo)}
                  className="text-white hover:bg-white/20"
                >
                  <Info className="w-5 h-5" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
        )
      ) : (
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4"
            >
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h1 className="text-white font-semibold text-lg truncate max-w-md">
                    {bookTitle}
                  </h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowInfo(!showInfo)}
                    className="text-white hover:bg-white/20"
                  >
                    <Info className="w-5 h-5" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Info Panel */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed top-20 right-4 z-50 glass-dark p-4 rounded-lg max-w-xs"
          >
            <h3 className="text-white font-semibold mb-2">Atalhos</h3>
            <div className="space-y-1 text-sm text-white/80">
              <p>← → : Navegar páginas</p>
              <p>Espaço : Próxima página</p>
              <p>+ / - : Zoom</p>
              <p>H : Destacar texto</p>
              <p>Ctrl+Shift+R : Ler em voz alta</p>
              <p>I : Mostrar/ocultar info</p>
              <p>ESC : Sair</p>
              <p className="pt-2 border-t border-white/20">
                Deslize para navegar
              </p>
              <p>Pinça para zoom (touch)</p>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/20">
              <label className="text-white text-sm font-medium mb-2 block">
                Velocidade do Zoom
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={zoomSensitivity}
                onChange={(e) => handleZoomSensitivityChange(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-white/60 mt-1">
                <span>Lento</span>
                <span>{zoomSensitivity.toFixed(1)}x</span>
                <span>Rápido</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Document */}
      <div ref={pdfContainerRef} className="w-full h-full flex items-center justify-center overflow-auto">
        <div className="relative">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center p-12">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            }
            error={
              <div className="p-12 text-center">
                <p className="text-white">Erro ao carregar o PDF</p>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              className="shadow-2xl"
              onLoadSuccess={(page) => {
                setPageSize({
                  width: page.width,
                  height: page.height,
                });
              }}
            />
          </Document>
          
          {/* Highlight Canvas Overlay */}
          {pageSize.width > 0 && pageSize.height > 0 && (
            <HighlightCanvas
              pageNumber={pageNumber}
              highlights={highlights}
              isDrawingMode={isHighlightMode}
              highlightColor={highlightColor}
              canvasWidth={pageSize.width}
              canvasHeight={pageSize.height}
              onHighlightAdded={onHighlightAdded}
            />
          )}
        </div>
      </div>

      {/* Navigation Arrows - Left */}
      {mobileConfig.shouldReduceAnimations ? (
        showControls && pageNumber > 1 && (
          <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevPage}
              className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
          </div>
        )
      ) : (
        <AnimatePresence>
          {showControls && pageNumber > 1 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="fixed left-4 top-1/2 -translate-y-1/2 z-50"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevPage}
                className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
              >
                <ChevronLeft className="w-8 h-8" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Navigation Arrows - Right */}
      {mobileConfig.shouldReduceAnimations ? (
        showControls && pageNumber < numPages && (
          <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextPage}
              className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          </div>
        )
      ) : (
        <AnimatePresence>
          {showControls && pageNumber < numPages && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="fixed right-4 top-1/2 -translate-y-1/2 z-50"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextPage}
                className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Bottom Controls */}
      {mobileConfig.shouldReduceAnimations ? (
        showControls && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 flex-wrap">
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomOut}
                disabled={scale <= 0.5}
                className="text-white hover:bg-white/20"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>

              <div className="glass-dark px-4 py-2 rounded-full text-white font-medium">
                <span className="text-lg">{Math.round(scale * 100)}%</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={zoomIn}
                disabled={scale >= 3.0}
                className="text-white hover:bg-white/20"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>

              <div className="h-8 w-px bg-white/20 mx-2" />

              <Button
                variant={isHighlightMode ? "default" : "ghost"}
                size="icon"
                onClick={() => setIsHighlightMode(!isHighlightMode)}
                className="text-white hover:bg-white/20"
                title="Destacar (H)"
              >
                <Highlighter className="w-5 h-5" />
              </Button>

              {isHighlightMode && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="text-white hover:bg-white/20"
                    title="Cor do destaque"
                  >
                    <Palette className="w-5 h-5" style={{ color: highlightColor }} />
                  </Button>

                  {showColorPicker && (
                    <div className="glass-dark p-2 rounded-lg flex gap-2">
                      {highlightColors.map(({ color, name }) => (
                        <button
                          key={color}
                          onClick={() => {
                            setHighlightColor(color);
                            setShowColorPicker(false);
                          }}
                          className={`w-8 h-8 rounded-full border-2 ${
                            highlightColor === color ? "border-white" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          title={name}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={handleSpeak}
                className="text-white hover:bg-white/20"
                title="Ler em voz alta"
              >
                <Volume2 className="w-5 h-5" />
              </Button>

              {highlightCount > 0 && onOpenHighlights && (
                <Button
                  variant="ghost"
                  onClick={onOpenHighlights}
                  className="text-white hover:bg-white/20 px-4"
                >
                  {highlightCount} {highlightCount === 1 ? "Destaque" : "Destaques"}
                </Button>
              )}
            </div>
          </div>
        )
      ) : (
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent p-4"
            >
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomOut}
                disabled={scale <= 0.5}
                className="text-white hover:bg-white/20"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>

              <div className="glass-dark px-4 py-2 rounded-full text-white font-medium">
                <span className="text-lg">{Math.round(scale * 100)}%</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={zoomIn}
                disabled={scale >= 3.0}
                className="text-white hover:bg-white/20"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>

              <div className="h-8 w-px bg-white/20 mx-2" />

              <Button
                variant={isHighlightMode ? "default" : "ghost"}
                size="icon"
                onClick={() => setIsHighlightMode(!isHighlightMode)}
                className={`${isHighlightMode ? "bg-primary text-primary-foreground" : "text-white hover:bg-white/20"} relative`}
                title={isHighlightMode ? "Desativar modo destaque (H)" : "Ativar modo destaque (H)"}
              >
                <Highlighter className="w-5 h-5" />
                {isHighlightMode && (
                  <div 
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: highlightColor }}
                  />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="text-white hover:bg-white/20 relative"
                title="Escolher cor do destaque"
              >
                <Palette className="w-5 h-5" />
                <div 
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
                  style={{ backgroundColor: highlightColor }}
                />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenHighlights}
                className="text-white hover:bg-white/20 relative"
                title="Ver destaques"
              >
                <Highlighter className="w-5 h-5" />
                {highlightCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {highlightCount > 9 ? '9+' : highlightCount}
                  </span>
                )}
              </Button>

              {highlights.length > 0 && (
                <HighlightImageDialog
                  text={highlights[highlights.length - 1]?.text || ""}
                  highlightId={highlights[highlights.length - 1]?.id || ""}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      title="Gerar imagem do destaque"
                    >
                      <Image className="w-5 h-5" />
                    </Button>
                  }
                />
              )}

              <div className="h-8 w-px bg-white/20 mx-2" />

              <TextToSpeechControls
                isSpeaking={tts.isSpeaking}
                isPaused={tts.isPaused}
                onSpeak={handleSpeak}
                onStop={tts.stop}
                onTogglePause={tts.togglePause}
                voices={tts.voices}
                selectedVoice={tts.selectedVoice}
                onVoiceChange={tts.setSelectedVoice}
                rate={tts.rate}
                onRateChange={tts.setRate}
                pitch={tts.pitch}
                onPitchChange={tts.setPitch}
              />

              <div className="h-8 w-px bg-white/20 mx-2" />

              <div className="glass-dark px-6 py-2 rounded-full text-white font-medium">
                <span className="text-lg">
                  {pageNumber} / {numPages}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      )}

      {/* Color Picker */}
      <AnimatePresence>
        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 glass-dark p-4 rounded-lg"
          >
            <h3 className="text-white text-sm font-semibold mb-3 text-center">
              Escolha a Cor do Destaque
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {highlightColors.map(({ color, name }) => (
                <button
                  key={color}
                  onClick={() => {
                    setHighlightColor(color);
                    setShowColorPicker(false);
                  }}
                  className={`w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                    highlightColor === color 
                      ? "border-white shadow-lg scale-105" 
                      : "border-white/30"
                  }`}
                  style={{ backgroundColor: color }}
                  title={name}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
