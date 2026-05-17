import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGamification } from "@/hooks/useGamification";

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

export const useHighlights = (bookId: string, pageNumber: number) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awardActionXP } = useGamification();

  // Query para highlights da página atual
  const { data: highlights = [], isLoading } = useQuery({
    queryKey: ["highlights", bookId, pageNumber],
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
    mutationFn: async ({ position, text, color }: { position: { x: number; y: number; width: number; height: number }, text: string, color: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("highlights")
        .insert({
          book_id: bookId,
          page_number: pageNumber,
          text: text || "",
          color: color || "#fef08a",
          position_data: position,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, text };
    },
    onSuccess: ({ data, text }) => {
      queryClient.invalidateQueries({ queryKey: ["highlights", bookId, pageNumber] });
      queryClient.invalidateQueries({ queryKey: ["highlights", bookId, "all"] });
      awardActionXP("highlight").catch(() => {});
      
      // Copiar texto automaticamente para área de transferência e mostrar preview
      if (text && text.trim()) {
        navigator.clipboard.writeText(text).then(() => {
          // Preview do texto extraído (máximo 150 caracteres)
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
            description: text.length > 100 
              ? `"${text.substring(0, 100)}..."` 
              : `"${text}"`,
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
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o destaque",
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
  });

  const addHighlight = useCallback(
    (position: { x: number; y: number; width: number; height: number }, text: string = "") => {
      addHighlightMutation.mutate({ position, text });
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
