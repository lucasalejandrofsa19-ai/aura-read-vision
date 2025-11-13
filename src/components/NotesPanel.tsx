import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StickyNote, Plus, Edit2, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Note } from "@/hooks/useNotes";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NotesPanelProps {
  notes: Note[];
  currentPage: number;
  onAddNote: (pageNumber: number, noteText: string) => void;
  onUpdateNote: (noteId: string, noteText: string) => void;
  onDeleteNote: (noteId: string) => void;
  onNavigateToPage: (pageNumber: number) => void;
}

export const NotesPanel = ({
  notes,
  currentPage,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onNavigateToPage,
}: NotesPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const currentPageNotes = notes.filter(
    (note) => note.page_number === currentPage
  );
  const otherNotes = notes.filter((note) => note.page_number !== currentPage);

  const handleAddNote = () => {
    if (newNoteText.trim()) {
      onAddNote(currentPage, newNoteText);
      setNewNoteText("");
      setIsAdding(false);
    }
  };

  const handleUpdateNote = (noteId: string) => {
    if (editText.trim()) {
      onUpdateNote(noteId, editText);
      setEditingNoteId(null);
      setEditText("");
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditText(note.note_text);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditText("");
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={`aura-soft transition-aura relative ${
          notes.length > 0 ? "text-accent" : ""
        }`}
        title="Anotações"
      >
        <StickyNote className="w-5 h-5" />
        {notes.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground rounded-full text-xs flex items-center justify-center">
            {notes.length}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed right-4 top-20 bottom-4 w-96 glass rounded-lg border border-border/50 shadow-2xl z-50 flex flex-col"
          >
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <StickyNote className="w-5 h-5" />
                  Anotações
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {notes.length} {notes.length === 1 ? "anotação" : "anotações"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {/* Current Page Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Página {currentPage}
                    </h4>
                    {!isAdding && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAdding(true)}
                        className="h-7 px-2 text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Nova
                      </Button>
                    )}
                  </div>

                  {isAdding && (
                    <Card className="p-3 mb-3 bg-accent/5">
                      <Textarea
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Digite sua anotação..."
                        className="mb-2 min-h-[80px] resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAddNote}
                          className="flex-1"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsAdding(false);
                            setNewNoteText("");
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </Card>
                  )}

                  {currentPageNotes.length === 0 && !isAdding && (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">
                      Nenhuma anotação nesta página
                    </p>
                  )}

                  {currentPageNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isEditing={editingNoteId === note.id}
                      editText={editText}
                      onEditTextChange={setEditText}
                      onStartEdit={startEditing}
                      onSaveEdit={handleUpdateNote}
                      onCancelEdit={cancelEditing}
                      onDelete={onDeleteNote}
                    />
                  ))}
                </div>

                {/* Other Pages Section */}
                {otherNotes.length > 0 && (
                  <div className="pt-4 border-t border-border/50">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      Outras páginas
                    </h4>
                    {otherNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        isEditing={editingNoteId === note.id}
                        editText={editText}
                        onEditTextChange={setEditText}
                        onStartEdit={startEditing}
                        onSaveEdit={handleUpdateNote}
                        onCancelEdit={cancelEditing}
                        onDelete={onDeleteNote}
                        onNavigate={onNavigateToPage}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface NoteCardProps {
  note: Note;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (text: string) => void;
  onStartEdit: (note: Note) => void;
  onSaveEdit: (noteId: string) => void;
  onCancelEdit: () => void;
  onDelete: (noteId: string) => void;
  onNavigate?: (pageNumber: number) => void;
}

const NoteCard = ({
  note,
  isEditing,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onNavigate,
}: NoteCardProps) => {
  return (
    <Card className="p-3 mb-2 hover:shadow-md transition-shadow">
      {isEditing ? (
        <>
          <Textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            className="mb-2 min-h-[80px] resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onSaveEdit(note.id)}
              className="flex-1"
            >
              <Check className="w-3 h-3 mr-1" />
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </>
      ) : (
        <>
          {onNavigate && (
            <button
              onClick={() => onNavigate(note.page_number)}
              className="text-xs text-primary hover:underline mb-1 block"
            >
              Página {note.page_number}
            </button>
          )}
          <p className="text-sm whitespace-pre-wrap mb-2">{note.note_text}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(note.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onStartEdit(note)}
                className="h-7 w-7"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(note.id)}
                className="h-7 w-7 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
