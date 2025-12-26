import { useState, useEffect } from "react";
import { Document, Page } from "react-pdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileImage, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker is configured globally in src/lib/pdfjsWorker.ts

interface SelectCoverPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPage: (pageNumber: number) => void;
  bookTitle: string;
  fileUrl?: string;
  totalPages?: number;
  isLoading?: boolean;
}

export const SelectCoverPageDialog = ({
  open,
  onOpenChange,
  onSelectPage,
  bookTitle,
  fileUrl,
  totalPages,
  isLoading = false,
}: SelectCoverPageDialogProps) => {
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(true);
  const [currentBatch, setCurrentBatch] = useState<number>(0);
  const PAGES_PER_BATCH = 12;

  useEffect(() => {
    if (open) {
      setSelectedPage(1);
      setCurrentBatch(0);
    }
  }, [open]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadingPdf(false);
  };

  const handleSubmit = () => {
    onSelectPage(selectedPage);
  };

  const startPage = currentBatch * PAGES_PER_BATCH + 1;
  const endPage = Math.min(startPage + PAGES_PER_BATCH - 1, numPages);
  const hasNextBatch = endPage < numPages;
  const hasPrevBatch = currentBatch > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="w-5 h-5" />
            Escolher Página da Capa - {bookTitle}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clique na página que deseja usar como capa
          </p>

          {fileUrl && (
            <div className="space-y-3">
              {loadingPdf && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => {
                  console.error("Error loading PDF:", error);
                  setLoadingPdf(false);
                }}
                className="hidden"
              >
                <Page pageNumber={1} />
              </Document>

              {!loadingPdf && numPages > 0 && (
                <>
                  {/* Navigation */}
                  <div className="flex items-center justify-between px-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentBatch(currentBatch - 1)}
                      disabled={!hasPrevBatch || isLoading}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Páginas {startPage}-{endPage} de {numPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentBatch(currentBatch + 1)}
                      disabled={!hasNextBatch || isLoading}
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>

                  {/* Pages Grid */}
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                      {Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                        const pageNum = startPage + i;
                        const isSelected = pageNum === selectedPage;
                        
                        return (
                          <div
                            key={pageNum}
                            onClick={() => !isLoading && setSelectedPage(pageNum)}
                            className={`
                              relative cursor-pointer rounded-lg overflow-hidden 
                              border-2 transition-all hover:shadow-lg
                              ${isSelected 
                                ? 'border-primary shadow-lg ring-2 ring-primary ring-offset-2' 
                                : 'border-border hover:border-primary/50'
                              }
                              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            <Document file={fileUrl}>
                              <Page
                                pageNumber={pageNum}
                                width={200}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                              />
                            </Document>
                            <div className={`
                              absolute bottom-0 left-0 right-0 py-2 text-center text-sm font-medium
                              ${isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-background/90 backdrop-blur-sm text-foreground'
                              }
                            `}>
                              Página {pageNum}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          )}

          {!fileUrl && (
            <div className="text-center py-12 text-muted-foreground">
              <FileImage className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>PDF não disponível para pré-visualização</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedPage || loadingPdf}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Gerando Capa...
              </>
            ) : (
              `Usar Página ${selectedPage}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
