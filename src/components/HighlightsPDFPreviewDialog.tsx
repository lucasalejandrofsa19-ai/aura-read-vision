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
import { Download, X, Edit2, Check, GripVertical } from "lucide-react";
import { HighlightsPDFDocument } from "./HighlightsPDFDocument";
import type { Note } from "@/hooks/useNotes";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Highlight {
  id: string;
  page_number: number;
  text: string;
  color: string | null;
  created_at: string;
}

interface SortableHighlightItemProps {
  highlight: Highlight;
  isEditing: boolean;
  editText: string;
  onStartEdit: (highlight: Highlight) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
}

const SortableHighlightItem = ({
  highlight,
  isEditing,
  editText,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTextChange,
}: SortableHighlightItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: highlight.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 border rounded-lg space-y-2",
        isEditing && "border-primary"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground">
            Página {highlight.page_number}
          </span>
        </div>
        {isEditing ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onSaveEdit}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onCancelEdit}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => onStartEdit(highlight)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      {isEditing ? (
        <Textarea
          value={editText}
          onChange={(e) => onEditTextChange(e.target.value)}
          className="text-xs min-h-[60px]"
          autoFocus
        />
      ) : (
        <p className="text-xs line-clamp-3">{highlight.text}</p>
      )}
    </div>
  );
};

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setEditedHighlights((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
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
              <h3 className="font-semibold text-sm mb-3">Editar e Reordenar Destaques</h3>
              <ScrollArea className="flex-1">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={editedHighlights.map((h) => h.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3 pr-4">
                      {editedHighlights.map((highlight) => (
                        <SortableHighlightItem
                          key={highlight.id}
                          highlight={highlight}
                          isEditing={editingId === highlight.id}
                          editText={editText}
                          onStartEdit={handleStartEdit}
                          onSaveEdit={handleSaveEdit}
                          onCancelEdit={handleCancelEdit}
                          onEditTextChange={setEditText}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
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
