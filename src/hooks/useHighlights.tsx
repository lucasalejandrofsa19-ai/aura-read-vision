import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import { Tables } from "@/integrations/supabase/types";

export type Highlight = Tables<"highlights">;

export const useHighlights = (bookId: string) => {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bookId && user) {
      loadHighlights();
    }
  }, [bookId, user]);

  const loadHighlights = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("highlights")
        .select("*")
        .eq("book_id", bookId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHighlights(data || []);
    } catch (error) {
      captureError(error, { context: "load_highlights" });
      toast.error("Erro ao carregar destaques");
    } finally {
      setLoading(false);
    }
  };

  const addHighlight = async (
    pageNumber: number,
    text: string,
    color: string,
    positionData?: { x: number; y: number; width: number; height: number }
  ) => {
    if (!user) {
      toast.error("Você precisa estar logado");
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("highlights")
        .insert({
          book_id: bookId,
          user_id: user.id,
          page_number: pageNumber,
          text,
          color,
          position_data: positionData || null,
        })
        .select()
        .single();

      if (error) throw error;

      setHighlights((prev) => [data, ...prev]);
      toast.success("Destaque adicionado!");
      return data;
    } catch (error) {
      captureError(error, { context: "add_highlight" });
      toast.error("Erro ao adicionar destaque");
      return null;
    }
  };

  const deleteHighlight = async (highlightId: string) => {
    try {
      const { error } = await supabase
        .from("highlights")
        .delete()
        .eq("id", highlightId);

      if (error) throw error;

      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      toast.success("Destaque removido!");
      return true;
    } catch (error) {
      captureError(error, { context: "delete_highlight" });
      toast.error("Erro ao remover destaque");
      return false;
    }
  };

  const getHighlightsForPage = (pageNumber: number) => {
    return highlights.filter((h) => h.page_number === pageNumber);
  };

  return {
    highlights,
    loading,
    addHighlight,
    deleteHighlight,
    getHighlightsForPage,
    refreshHighlights: loadHighlights,
  };
};
