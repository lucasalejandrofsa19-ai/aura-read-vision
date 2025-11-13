import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import type { Tables } from "@/integrations/supabase/types";

export type Note = Tables<"notes">;

export const useNotes = (bookId: string) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = async () => {
    if (!user || !bookId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("book_id", bookId)
        .eq("user_id", user.id)
        .order("page_number", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      captureError(error, { context: "load_notes" });
      toast.error("Erro ao carregar anotações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [bookId, user]);

  const addNote = async (pageNumber: number, noteText: string) => {
    if (!user || !bookId) {
      toast.error("Você precisa estar logado");
      return;
    }

    if (!noteText.trim()) {
      toast.error("A anotação não pode estar vazia");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          book_id: bookId,
          page_number: pageNumber,
          note_text: noteText.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setNotes((prev) => [...prev, data]);
      toast.success("Anotação adicionada!");
      return data;
    } catch (error) {
      captureError(error, { context: "add_note" });
      toast.error("Erro ao adicionar anotação");
    }
  };

  const updateNote = async (noteId: string, noteText: string) => {
    if (!noteText.trim()) {
      toast.error("A anotação não pode estar vazia");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notes")
        .update({ note_text: noteText.trim() })
        .eq("id", noteId)
        .select()
        .single();

      if (error) throw error;

      setNotes((prev) =>
        prev.map((note) => (note.id === noteId ? data : note))
      );
      toast.success("Anotação atualizada!");
    } catch (error) {
      captureError(error, { context: "update_note" });
      toast.error("Erro ao atualizar anotação");
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      toast.success("Anotação removida");
    } catch (error) {
      captureError(error, { context: "delete_note" });
      toast.error("Erro ao remover anotação");
    }
  };

  const getNotesForPage = (pageNumber: number) => {
    return notes.filter((note) => note.page_number === pageNumber);
  };

  const refreshNotes = () => {
    loadNotes();
  };

  return {
    notes,
    loading,
    addNote,
    updateNote,
    deleteNote,
    getNotesForPage,
    refreshNotes,
  };
};
