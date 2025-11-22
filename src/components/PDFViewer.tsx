import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { PDFSearchBar } from "@/components/PDFSearchBar";
import { PrefetchIndicator } from "@/components/PrefetchIndicator";
import { usePDFPrefetch } from "@/hooks/usePDFPrefetch";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
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
  bookmarkIndicator?: React.ReactNode;
}

export const PDFViewer = ({ 
  fileUrl, 
  initialPage = 1, 
  onPageChange,
  onTextSelect,
  highlightedAreas = [],
  bookmarkIndicator
}: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.0);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [pageTexts, setPageTexts] = useState<Map<number, string>>(new Map());
  const [isPrefetching, setIsPrefetching] = useState(false);

  // Prefetch hook para carregar próximas páginas
  const { isPageCached, cache } = usePDFPrefetch({
    fileUrl,
    currentPage: pageNumber,
    numPages,
    prefetchCount: 3, // Prefetch de 3 páginas à frente
  });

  // Detectar quando está fazendo prefetch
  useEffect(() => {
    setIsPrefetching(true);
    const timer = setTimeout(() => setIsPrefetching(false), 1000);
    return () => clearTimeout(timer);
  }, [pageNumber]);

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
    setPageTexts(new Map());
  };

  const extractTextFromPage = async (pageNum: number, pdfDoc: any) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: TextItem) => ('str' in item ? item.str : ''))
        .join(' ')
        .toLowerCase();
      return text;
    } catch (error) {
      console.error(`Error extracting text from page ${pageNum}:`, error);
      return '';
    }
  };

  const handleSearch = async (term: string) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      setSearchTerm("");
      return;
    }

    setIsSearching(true);
    setSearchTerm(term.toLowerCase());
    const results: number[] = [];

    try {
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdfDoc = await loadingTask.promise;

      for (let i = 1; i <= numPages; i++) {
        let text = pageTexts.get(i);
        if (!text) {
          text = await extractTextFromPage(i, pdfDoc);
          setPageTexts(prev => new Map(prev).set(i, text));
        }

        if (text.includes(term.toLowerCase())) {
          results.push(i);
        }
      }

      setSearchResults(results);
      setCurrentResultIndex(0);
      
      if (results.length > 0) {
        changePage(results[0]);
      }
    } catch (error) {
      console.error("Error searching PDF:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNextResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(nextIndex);
    changePage(searchResults[nextIndex]);
  };

  const handlePrevResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = currentResultIndex === 0 ? searchResults.length - 1 : currentResultIndex - 1;
    setCurrentResultIndex(prevIndex);
    changePage(searchResults[prevIndex]);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setCurrentResultIndex(0);
  };

  const changePage = (page: number) => {
    setPageNumber(page);
    onPageChange?.(page);
  };

  const goToPrevPage = () => {
    const newPage = Math.max(pageNumber - 1, 1);
    changePage(newPage);
  };

  const goToNextPage = () => {
    const newPage = Math.min(pageNumber + 1, numPages);
    changePage(newPage);
  };

  const zoomIn = () => {
    setAutoFit(false);
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setAutoFit(false);
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const fitToWidth = () => {
    setAutoFit(true);
    if (containerRef.current) {
      // Calculate scale to fit width (accounting for padding)
      const containerWidth = containerRef.current.clientWidth - 40;
      const pageWidth = 595; // Standard PDF page width in points
      const newScale = containerWidth / pageWidth;
      setScale(Math.max(0.5, Math.min(newScale, 3.0)));
    }
  };

  useEffect(() => {
    if (autoFit) {
      fitToWidth();
    }
  }, [autoFit, pageNumber]);

  useEffect(() => {
    const handleResize = () => {
      if (autoFit) {
        fitToWidth();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoFit]);

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4">
      {/* Controls */}
      <div className="space-y-4 md:space-y-3 w-full flex flex-col items-center">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={fitToWidth}
            className={`aura-soft ${autoFit ? 'text-primary' : ''}`}
            title="Ajustar à largura"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          
          <div className="h-6 w-px bg-border mx-2" />
          
          <PDFSearchBar
            onSearch={handleSearch}
            onNextResult={handleNextResult}
            onPrevResult={handlePrevResult}
            onClear={handleClearSearch}
            currentResultIndex={currentResultIndex}
            totalResults={searchResults.length}
            isSearching={isSearching}
          />
          
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
            title={isPageCached(pageNumber + 1) ? "Próxima página (pré-carregada)" : "Próxima página"}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Bookmark indicator below controls with extra spacing on mobile */}
        {bookmarkIndicator && (
          <div className="mb-4 md:mb-0">
            {bookmarkIndicator}
          </div>
        )}
      </div>

      {/* PDF Document */}
      <div 
        ref={pageRef}
        className="border border-border rounded-lg overflow-auto shadow-lg bg-muted/20 relative"
      >
        {/* Indicador de prefetch */}
        <PrefetchIndicator 
          isActive={isPrefetching} 
          cachedPagesCount={cache.size}
        />
        
        {/* Indicador de página pronta */}
        {isPageCached(pageNumber + 1) && (
          <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-md bg-green-500/20 border border-green-500/30 backdrop-blur-sm">
            <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Próxima página pronta
            </span>
          </div>
        )}
        
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
            loading={
              <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }
            customTextRenderer={(textItem) => {
              const text = 'str' in textItem ? textItem.str : '';
              if (searchTerm && text.toLowerCase().includes(searchTerm)) {
                return text
                  .split(new RegExp(`(${searchTerm})`, 'gi'))
                  .map((part, i) => 
                    part.toLowerCase() === searchTerm 
                      ? `<mark style="background-color: #fef08a; color: #000; padding: 2px 0;">${part}</mark>`
                      : part
                  )
                  .join('');
              }
              return text;
            }}
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
