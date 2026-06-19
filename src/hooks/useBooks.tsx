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

          const cover_image_url = await getSignedStorageUrl("premium-covers", book.cover_image_url);

          return {
            ...book,
            cover_image_url,
            file_url: signedData?.signedUrl ?? ""
          };
        })
      );

      return booksWithUrls;
    },
    enabled: !!user,
    // URLs assinadas valem 1h; alinhar staleTime evita refetches que
    // disparam N requests de createSignedUrl sem ganho real para o usuário.
    staleTime: 45 * 60 * 1000, // 45 min
    gcTime: 60 * 60 * 1000,    // 1 hora
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

          const cover_image_url = await getSignedStorageUrl("premium-covers", book.cover_image_url);
          return {
            ...book,
            cover_image_url,
            file_url: signedData?.signedUrl ?? ""
          };
        })
      );
      
      return booksWithUrls;
    },
    staleTime: 30 * 60 * 1000, // 30 min (premium muda pouco, URL vale 1h)
    gcTime: 60 * 60 * 1000,
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
