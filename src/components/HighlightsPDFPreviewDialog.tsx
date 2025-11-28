import React, { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download, X, Edit2, Check } from "lucide-react";
import { HighlightsPDFDocument } from "./HighlightsPDFDocument";
import type { Note } from "@/hooks/useNotes";
import { cn } from "@/lib/utils";

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
  onDownload: (
    options: {
      includeHighlights: boolean;
      includeNotes: boolean;
      groupByPage: boolean;
      includeTimestamps: boolean;
      includeColors: boolean;
    },
    editedHighlights: Highlight[]
  ) => void;
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
  const [editedHighlights, setEditedHighlights] = useState<Highlight[]>(highlights);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Reset edited highlights when dialog opens or highlights change
  useEffect(() => {
    if (open) {
      setEditedHighlights(highlights);
      setEditingId(null);
      setEditText("");
    }
  }, [open, highlights]);

  const handleStartEdit = (highlight: Highlight) => {
    setEditingId(highlight.id);
    setEditText(highlight.text);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      setEditedHighlights((prev) =>
        prev.map((h) =>
          h.id === editingId ? { ...h, text: editText } : h
        )
      );
      setEditingId(null);
      setEditText("");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleDownload = () => {
    onDownload(
      {
        includeHighlights,
        includeNotes,
        groupByPage,
        includeTimestamps,
        includeColors,
      },
      editedHighlights
    );
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
          {/* Options and Edit Panel */}
          <div className="w-80 flex-shrink-0 space-y-4 flex flex-col overflow-hidden">
            {/* Options Section */}
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
                  Incluir Destaques ({editedHighlights.length})
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

            <Separator />

            {/* Edit Highlights Section */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <h3 className="font-semibold text-sm mb-3">Editar Destaques</h3>
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {editedHighlights.map((highlight) => (
                    <div
                      key={highlight.id}
                      className={cn(
                        "p-3 border rounded-lg space-y-2",
                        editingId === highlight.id && "border-primary"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          Página {highlight.page_number}
                        </span>
                        {editingId === highlight.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={handleSaveEdit}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleStartEdit(highlight)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {editingId === highlight.id ? (
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="text-xs min-h-[60px]"
                          autoFocus
                        />
                      ) : (
                        <p className="text-xs line-clamp-3">{highlight.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* PDF Preview */}
          <div className="flex-1 border rounded-lg overflow-hidden">
            <PDFViewer width="100%" height="100%" showToolbar={false}>
              <HighlightsPDFDocument
                bookTitle={bookTitle}
                highlights={editedHighlights}
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
