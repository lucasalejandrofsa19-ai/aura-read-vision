import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
    mutationFn: async ({ position, text }: { position: { x: number; y: number; width: number; height: number }, text: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("highlights")
        .insert({
          book_id: bookId,
          page_number: pageNumber,
          text: text || "",
          color: "#fef08a",
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
      
      // Copiar texto automaticamente para área de transferência
      if (text && text.trim()) {
        navigator.clipboard.writeText(text).then(() => {
          toast({
            title: "Destaque adicionado e copiado",
            description: "Texto copiado para área de transferência",
          });
        }).catch(() => {
          toast({
            title: "Destaque adicionado",
            description: "Seu destaque foi salvo com sucesso",
          });
        });
      } else {
        toast({
          title: "Destaque adicionado",
          description: "Seu destaque foi salvo com sucesso",
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
