import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSignedStorageUrl } from "@/lib/storageUrl";

export const useBooks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user books with cache
  const { data: books = [], isLoading } = useQuery({
    queryKey: ["books", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Generate signed URLs for PDFs (private bucket)
      const booksWithUrls = await Promise.all(
        (data || []).map(async (book) => {
          const { data: signedData } = await supabase.storage
            .from("pdfs")
            .createSignedUrl(book.file_path, 60 * 60); // 1 hour

          return {
            ...book,
            file_url: signedData?.signedUrl ?? ""
          };
        })
      );

      return booksWithUrls;
    },
    enabled: !!user,
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 5 * 60 * 1000,
  });

  // Fetch premium books with cache
  const { data: premiumBooks = [] } = useQuery({
    queryKey: ["premium-books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("premium_books")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Generate signed URLs for premium PDFs (private bucket)
      const booksWithUrls = await Promise.all(
        (data || []).map(async (book) => {
          const { data: signedData } = await supabase.storage
            .from("premium-pdfs")
            .createSignedUrl(book.file_path, 60 * 60); // 1 hour

          return {
            ...book,
            file_url: signedData?.signedUrl ?? ""
          };
        })
      );
      
      return booksWithUrls;
    },
    staleTime: 10 * 60 * 1000, // 10 minutos (premium books mudam menos)
    gcTime: 15 * 60 * 1000,
  });

  // Mutation para deletar livro
  const deleteBookMutation = useMutation({
    mutationFn: async (bookId: string) => {
      const { error } = await supabase
        .from("books")
        .delete()
        .eq("id", bookId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books", user?.id] });
    },
  });

  return {
    books,
    premiumBooks,
    isLoading,
    deleteBook: deleteBookMutation.mutate,
    isDeleting: deleteBookMutation.isPending,
  };
};
