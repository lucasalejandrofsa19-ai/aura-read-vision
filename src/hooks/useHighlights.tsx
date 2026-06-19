import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGamification } from "@/hooks/useGamification";

const HIGHLIGHT_TOAST_ID = "highlight-save-status";

export interface Highlight {
  id: string;
  book_id: string;
  page_number: number;
  text: string;
  color: string;
  position_data: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  created_at: string;
  user_id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const useHighlights = (bookId: string, pageNumber: number) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awardActionXP } = useGamification();
  const validBook = !!bookId && UUID_RE.test(bookId);

  // Query para highlights da página atual
  const { data: highlights = [], isLoading } = useQuery({
    queryKey: ["highlights", bookId, pageNumber],
    enabled: validBook,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("highlights")
        .select("*")
        .eq("book_id", bookId)
        .eq("page_number", pageNumber)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Highlight[];
    },
  });

  // Query para todos os highlights do livro
  const { data: allHighlights = [] } = useQuery({
    queryKey: ["highlights", bookId, "all"],
    enabled: validBook,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("highlights")
        .select("*")
        .eq("book_id", bookId)
        .order("page_number", { ascending: true });

      if (error) throw error;
      return data as Highlight[];
    },
  });

  const addHighlightMutation = useMutation({
    onMutate: () => {
      sonnerToast.loading("Salvando highlight…", { id: HIGHLIGHT_TOAST_ID });
    },
    mutationFn: async ({ position, text, color }: { position: { x: number; y: number; width: number; height: number }, text: string, color: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para criar destaques");
      if (!validBook) throw new Error("ID do livro inválido");


      const payload = {
        book_id: bookId,
        page_number: Math.max(1, Number(pageNumber) || 1),
        text: ((text ?? "").toString().slice(0, 5000)) || " ",
        color: color || "#fef08a",
        position_data: {
          x: Number(position?.x) || 0,
          y: Number(position?.y) || 0,
          width: Number(position?.width) || 0,
          height: Number(position?.height) || 0,
        },
        user_id: user.id,
      };

      console.info("[useHighlights] INSERT iniciando…", {
        bookId,
        pageNumber: payload.page_number,
        textLength: payload.text.length,
        color: payload.color,
        userId: user.id,
      });
      const t0 = performance.now();

      const { data, error } = await supabase
        .from("highlights")
        .insert(payload)
        .select()
        .single();

      const elapsed = Math.round(performance.now() - t0);
      if (error) {
        console.error("[useHighlights] INSERT falhou:", { elapsed, error });
        throw error;
      }
      console.info("[useHighlights] INSERT confirmado ✅", {
        elapsed,
        highlightId: data?.id,
      });
      return { data, text };
    },
    onSuccess: ({ data, text }) => {
      queryClient.invalidateQueries({ queryKey: ["highlights", bookId, pageNumber] });
      queryClient.invalidateQueries({ queryKey: ["highlights", bookId, "all"] });
      awardActionXP("highlight").catch(() => {});

      if (text && text.trim()) {
        navigator.clipboard.writeText(text).then(() => {
          const preview = text.length > 150 ? text.substring(0, 150) + "..." : text;
          toast({
            title: "✨ Destaque criado com sucesso",
            description: (
              <div className="space-y-2 mt-2">
                <div className="text-xs text-muted-foreground">Texto extraído e copiado:</div>
                <div className="bg-muted/50 rounded p-2 text-sm border border-border/50 max-h-32 overflow-y-auto">
                  "{preview}"
                </div>
                <div className="text-xs text-muted-foreground italic">
                  📋 Colado automaticamente na área de transferência
                </div>
              </div>
            ),
            duration: 5000,
          });
        }).catch(() => {
          toast({
            title: "Destaque adicionado",
            description: text.length > 100 ? `"${text.substring(0, 100)}..."` : `"${text}"`,
            duration: 4000,
          });
        });
      } else {
        toast({
          title: "Destaque adicionado",
          description: "⚠️ Nenhum texto foi extraído desta área",
          duration: 3000,
        });
      }
    },
    onError: (error: any) => {
      const msg =
        error?.message ||
        error?.error_description ||
        error?.hint ||
        "Não foi possível adicionar o destaque";
      console.error("[useHighlights] mutation error:", error);
      toast({
        title: "Erro ao adicionar destaque",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const deleteHighlightMutation = useMutation({
    mutationFn: async (highlightId: string) => {
      const { error } = await supabase
        .from("highlights")
        .delete()
        .eq("id", highlightId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlights", bookId, pageNumber] });
      queryClient.invalidateQueries({ queryKey: ["highlights", bookId, "all"] });
      toast({
        title: "Destaque removido",
        description: "Seu destaque foi excluído",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover destaque",
        description: error?.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const addHighlight = useCallback(
    (position: { x: number; y: number; width: number; height: number }, text: string = "", color: string = "#fef08a") => {
      addHighlightMutation.mutate({ position, text, color });
    },
    [addHighlightMutation]
  );

  const deleteHighlight = useCallback(
    (highlightId: string) => {
      deleteHighlightMutation.mutate(highlightId);
    },
    [deleteHighlightMutation]
  );

  return {
    highlights,
    allHighlights,
    isLoading,
    addHighlight,
    deleteHighlight,
  };
};
