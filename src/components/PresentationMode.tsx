import { useState, useEffect, useCallback, useRef, memo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
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
}

export const PresentationMode = memo(({
  fileUrl,
  initialPage = 1,
  bookTitle,
  onClose,
  onPageChange,
}: PresentationModeProps) => {
  const mobileConfig = useMobileOptimization();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(mobileConfig.isMobile ? 1.0 : 1.2);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [zoomSensitivity, setZoomSensitivity] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout>();
  
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
          onClose();
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
        case "i":
        case "I":
          e.preventDefault();
          setShowInfo((prev) => !prev);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevPage, goToNextPage, onClose]);

  // Auto-hide controls com debounce
  useEffect(() => {
    const resetTimeout = () => {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    let mouseMoveTimeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      clearTimeout(mouseMoveTimeout);
      mouseMoveTimeout = setTimeout(resetTimeout, 100);
    };
    
    const handleTouchStart = () => resetTimeout();

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    resetTimeout();

    return () => {
      clearTimeout(mouseMoveTimeout);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  }, []);

  const onPageLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const onPageLoadSuccess = useCallback(() => {
    setIsLoading(false);
  }, []);

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
      {/* Top Controls - Sempre sem animação para melhor performance */}
      {showControls && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-200">
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
      )}

      {/* Info Panel - Sem animação */}
      {showInfo && (
        <div className="fixed top-20 right-4 z-50 glass-dark p-4 rounded-lg max-w-xs transition-opacity duration-200">
            <h3 className="text-white font-semibold mb-2">Atalhos</h3>
            <div className="space-y-1 text-sm text-white/80">
              <p>← → : Navegar páginas</p>
              <p>Espaço : Próxima página</p>
              <p>+ / - : Zoom</p>
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
        </div>
      )}

      {/* PDF Document */}
      <div 
        ref={pdfContainerRef} 
        className="w-full h-full flex items-center justify-center overflow-auto"
      >
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
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
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-2xl"
              onLoadStart={onPageLoadStart}
              onLoadSuccess={onPageLoadSuccess}
            />
          </Document>
        </div>
      </div>

      {/* Navigation Arrows - Left - Sem animação */}
      {showControls && pageNumber > 1 && (
        <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 transition-opacity duration-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevPage}
            disabled={isLoading}
            className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm disabled:opacity-50"
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
        </div>
      )}

      {/* Navigation Arrows - Right - Sem animação */}
      {showControls && pageNumber < numPages && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 transition-opacity duration-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPage}
            disabled={isLoading}
            className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm disabled:opacity-50"
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        </div>
      )}

      {/* Bottom Controls - Sem animação */}
      {showControls && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-200">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              disabled={scale <= 0.5 || isLoading}
              className="text-white hover:bg-white/20 disabled:opacity-50"
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
              disabled={scale >= 3.0 || isLoading}
              className="text-white hover:bg-white/20 disabled:opacity-50"
            >
              <ZoomIn className="w-5 h-5" />
            </Button>

            <div className="h-8 w-px bg-white/20 mx-2" />

            <div className="glass-dark px-6 py-2 rounded-full text-white font-medium">
              <span className="text-lg">
                {pageNumber} / {numPages}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
