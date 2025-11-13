import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  fileUrl: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onTextSelect?: (text: string) => void;
  highlightedAreas?: Array<{ x: number; y: number; width: number; height: number; color: string }>;
}

export const PDFViewer = ({ 
  fileUrl, 
  initialPage = 1, 
  onPageChange,
  onTextSelect,
  highlightedAreas = []
}: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.0);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageNumber(initialPage);
  }, [initialPage]);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      
      if (selectedText && selectedText.length > 0) {
        onTextSelect?.(selectedText);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [onTextSelect]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const goToPrevPage = () => {
    const newPage = Math.max(pageNumber - 1, 1);
    setPageNumber(newPage);
    onPageChange?.(newPage);
  };

  const goToNextPage = () => {
    const newPage = Math.min(pageNumber + 1, numPages);
    setPageNumber(newPage);
    onPageChange?.(newPage);
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Controls */}
      <div className="glass sticky top-20 z-40 rounded-lg p-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={zoomOut}
          disabled={scale <= 0.5}
          className="aura-soft"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={zoomIn}
          disabled={scale >= 3.0}
          className="aura-soft"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <div className="h-6 w-px bg-border mx-2" />
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevPage}
          disabled={pageNumber <= 1}
          className="aura-soft"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium min-w-[80px] text-center">
          {pageNumber} / {numPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextPage}
          disabled={pageNumber >= numPages}
          className="aura-soft"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* PDF Document */}
      <div 
        ref={pageRef}
        className="border border-border rounded-lg overflow-auto shadow-lg bg-muted/20 relative"
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center p-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
          error={
            <div className="p-12 text-center">
              <p className="text-destructive">Erro ao carregar o PDF</p>
            </div>
          }
        >
          <div className="relative">
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
            {/* Highlight overlays */}
            {highlightedAreas.map((area, index) => (
              <div
                key={index}
                className="absolute pointer-events-none transition-opacity"
                style={{
                  left: `${area.x}px`,
                  top: `${area.y}px`,
                  width: `${area.width}px`,
                  height: `${area.height}px`,
                  backgroundColor: area.color,
                  opacity: 0.4,
                  mixBlendMode: "multiply",
                }}
              />
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
};
