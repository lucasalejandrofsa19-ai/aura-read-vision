import React, { useState } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, X } from "lucide-react";
import { HighlightsPDFDocument } from "./HighlightsPDFDocument";
import type { Note } from "@/hooks/useNotes";

interface Highlight {
  id: string;
  page_number: number;
  text: string;
  color: string | null;
  created_at: string;
}

interface HighlightsPDFPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle: string;
  highlights: Highlight[];
  notes?: Note[];
  onDownload: (options: {
    includeHighlights: boolean;
    includeNotes: boolean;
    groupByPage: boolean;
    includeTimestamps: boolean;
    includeColors: boolean;
  }) => void;
}

export const HighlightsPDFPreviewDialog = ({
  open,
  onOpenChange,
  bookTitle,
  highlights,
  notes = [],
  onDownload,
}: HighlightsPDFPreviewDialogProps) => {
  const [includeHighlights, setIncludeHighlights] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [groupByPage, setGroupByPage] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeColors, setIncludeColors] = useState(true);

  const handleDownload = () => {
    onDownload({
      includeHighlights,
      includeNotes,
      groupByPage,
      includeTimestamps,
      includeColors,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Pré-visualização do PDF</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Options Panel */}
          <div className="w-64 flex-shrink-0 space-y-4 overflow-y-auto">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Opções de Exportação</h3>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeHighlights"
                  checked={includeHighlights}
                  onCheckedChange={(checked) =>
                    setIncludeHighlights(checked as boolean)
                  }
                />
                <Label htmlFor="includeHighlights" className="text-sm">
                  Incluir Destaques ({highlights.length})
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeNotes"
                  checked={includeNotes}
                  onCheckedChange={(checked) =>
                    setIncludeNotes(checked as boolean)
                  }
                />
                <Label htmlFor="includeNotes" className="text-sm">
                  Incluir Anotações ({notes.length})
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="groupByPage"
                  checked={groupByPage}
                  onCheckedChange={(checked) =>
                    setGroupByPage(checked as boolean)
                  }
                />
                <Label htmlFor="groupByPage" className="text-sm">
                  Agrupar por Página
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeTimestamps"
                  checked={includeTimestamps}
                  onCheckedChange={(checked) =>
                    setIncludeTimestamps(checked as boolean)
                  }
                />
                <Label htmlFor="includeTimestamps" className="text-sm">
                  Incluir Data/Hora
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeColors"
                  checked={includeColors}
                  onCheckedChange={(checked) =>
                    setIncludeColors(checked as boolean)
                  }
                />
                <Label htmlFor="includeColors" className="text-sm">
                  Incluir Cores
                </Label>
              </div>
            </div>
          </div>

          {/* PDF Preview */}
          <div className="flex-1 border rounded-lg overflow-hidden">
            <PDFViewer width="100%" height="100%" showToolbar={false}>
              <HighlightsPDFDocument
                bookTitle={bookTitle}
                highlights={highlights}
                notes={notes}
                options={{
                  includeHighlights,
                  includeNotes,
                  groupByPage,
                  includeTimestamps,
                  includeColors,
                }}
              />
            </PDFViewer>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
