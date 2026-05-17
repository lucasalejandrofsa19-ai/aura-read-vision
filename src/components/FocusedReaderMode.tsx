import { useState, useEffect } from "react";
import { X, Eye, Moon, Sun, Contrast, Highlighter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document, Page } from "react-pdf";
import { HighlightCanvas } from "@/components/HighlightCanvas";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker is configured globally in src/lib/pdfjsWorker.ts

type ReadingMode = "default" | "sepia" | "dark" | "high-contrast";

interface FocusedReaderModeProps {
  fileUrl: string;
  initialPage: number;
  totalPages: number;
  bookTitle: string;
  onClose: () => void;
  onPageChange: (page: number) => void;
  highlights?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  onHighlightDrawn?: (coords: { x: number; y: number; width: number; height: number; text: string; color: string }) => void;
  isDrawingMode?: boolean;
  onDrawingModeChange?: (isDrawing: boolean) => void;
  highlightColor?: string;
  penThickness?: number;
}

const readingModeStyles: Record<ReadingMode, { bg: string; text: string; label: string; icon: typeof Eye }> = {
  default: {
    bg: "bg-background",
    text: "text-foreground",
    label: "Padrão",
    icon: Eye,
  },
  sepia: {
    bg: "bg-[#f4ecd8]",
    text: "text-[#5c4a3a]",
    label: "Sépia",
    icon: Sun,
  },
  dark: {
    bg: "bg-[#1a1a1a]",
    text: "text-[#e0e0e0]",
    label: "Escuro",
    icon: Moon,
  },
  "high-contrast": {
    bg: "bg-black",
    text: "text-white",
    label: "Alto Contraste",
    icon: Contrast,
  },
};

export const FocusedReaderMode = ({
  fileUrl,
  initialPage,
  totalPages,
  bookTitle,
  onClose,
  onPageChange,
  highlights = [],
  onHighlightDrawn,
  isDrawingMode = false,
  onDrawingModeChange,
}: FocusedReaderModeProps) => {
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [readingMode, setReadingMode] = useState<ReadingMode>("default");
  const [showControls, setShowControls] = useState(true);
  const [scale, setScale] = useState(1.2);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (showControls) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [showControls]);

  const handleMouseMove = () => {
    setShowControls(true);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPageNumber(newPage);
      onPageChange(newPage);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      handlePageChange(pageNumber + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      handlePageChange(pageNumber - 1);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [pageNumber]);

  const currentStyle = readingModeStyles[readingMode];

  return (
    <div
      className={`fixed inset-0 z-[100] ${currentStyle.bg} ${currentStyle.text}`}
      onMouseMove={handleMouseMove}
    >
      {/* Top Controls */}
      {showControls && (
        <div className="fixed top-0 left-0 right-0 z-[101] p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between backdrop-blur-xl bg-background/80 rounded-lg px-6 py-3 shadow-lg border border-border/50">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="aura-soft"
                 aria-label="Fechar">
                  <X className="w-5 h-5" />
                </Button>
                <div>
                  <h2 className="font-semibold text-sm">{bookTitle}</h2>
                  <p className="text-xs text-muted-foreground">
                    Modo Leitura Focada
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isDrawingMode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onDrawingModeChange?.(!isDrawingMode)}
                  className="gap-2"
                  title={isDrawingMode ? "Desativar marca texto" : "Ativar marca texto"}
                >
                  <Highlighter className="w-4 h-4" />
                  Destaque
                </Button>
                
                {(Object.keys(readingModeStyles) as ReadingMode[]).map((mode) => {
                  const Icon = readingModeStyles[mode].icon;
                  return (
                    <Button
                      key={mode}
                      variant={readingMode === mode ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setReadingMode(mode)}
                      className="gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      {readingModeStyles[mode].label}
                    </Button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* PDF Content */}
      <div className={`h-full flex items-center justify-center p-8 overflow-auto ${isDrawingMode ? 'drawing-mode' : ''}`}>
        <div className="max-w-4xl mx-auto">
          <Document
            file={fileUrl}
            loading={
              <div className="flex items-center justify-center p-12">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }
            error={
              <div className="p-12 text-center">
                <p className="text-destructive">Erro ao carregar PDF</p>
              </div>
            }
          >
            <div className="relative">
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                onLoadSuccess={(page) => {
                  setPageSize({
                    width: page.width,
                    height: page.height,
                  });
                }}
                loading={
                  <div className="flex items-center justify-center p-12">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                }
                className="shadow-2xl"
              />
              
              {pageSize.width > 0 && pageSize.height > 0 && (
                <HighlightCanvas
                  key={`canvas-${pageNumber}-${Math.round(pageSize.width)}-${Math.round(pageSize.height)}`}
                  width={pageSize.width}
                  height={pageSize.height}
                  highlights={highlights.map(h => ({
                    ...h,
                    x: h.x * scale,
                    y: h.y * scale,
                    width: h.width * scale,
                    height: h.height * scale,
                  }))}
                  onHighlightAdded={async (coords) => {
                    const realScale = pageSize.width / 595;
                    const originalCoords = {
                      x: coords.x / realScale,
                      y: coords.y / realScale,
                      width: coords.width / realScale,
                      height: coords.height / realScale,
                    };
                    // For FocusedReaderMode, we pass empty text since we don't have text extraction here yet
                    onHighlightDrawn?.({ ...originalCoords, text: "" });
                  }}
                  isDrawing={isDrawingMode}
                />
              )}
            </div>
          </Document>
        </div>
      </div>

      {/* Bottom Controls */}
      {showControls && (
        <div className="fixed bottom-0 left-0 right-0 z-[101] p-4">
            <div className="max-w-3xl mx-auto backdrop-blur-xl bg-background/80 rounded-lg px-6 py-3 shadow-lg border border-border/50">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(pageNumber - 1)}
                  disabled={pageNumber <= 1}
                >
                  ← Anterior
                </Button>

                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    Página {pageNumber} de {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setScale((prev) => Math.max(0.8, prev - 0.1))}
                      disabled={scale <= 0.8}
                    >
                      A-
                    </Button>
                    <span className="text-xs text-muted-foreground min-w-[50px] text-center">
                      {Math.round(scale * 100)}%
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setScale((prev) => Math.min(2.0, prev + 0.1))}
                      disabled={scale >= 2.0}
                    >
                      A+
                    </Button>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(pageNumber + 1)}
                  disabled={pageNumber >= totalPages}
                >
                  Próxima →
                </Button>
              </div>

              <div className="mt-2">
                <input
                  type="range"
                  min="1"
                  max={totalPages}
                  value={pageNumber}
                  onChange={(e) => handlePageChange(parseInt(e.target.value))}
                  className="w-full h-1 bg-border/30 rounded-lg appearance-none cursor-pointer slider-thumb"
                  aria-label={`Ir para página (atual: ${pageNumber} de ${totalPages})`}
                />
              </div>
            </div>
          </div>
        )}

      {/* Hint */}
      {showControls && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100]">
          <div className="backdrop-blur-xl bg-background/60 rounded-full px-4 py-2 text-xs text-muted-foreground border border-border/30">
            Use ← → para navegar • ESC para sair
          </div>
        </div>
      )}

      <style>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          transition: all 0.2s;
        }
        .slider-thumb::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        .slider-thumb::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }
        .slider-thumb::-moz-range-thumb:hover {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
};
