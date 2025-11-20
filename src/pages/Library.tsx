import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, User, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import BookCard from "@/components/BookCard";
import UploadPDF from "@/components/UploadPDF";
import SubscriptionDialog from "@/components/SubscriptionDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";

const Library = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const { user, signOut, subscriptionTier, checkSubscription } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    loadBooks();
    checkSubscription();
  }, [user, navigate]);

  const loadBooks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBooks(data || []);
    } catch (error) {
      captureError(error, { context: "load_books" });
      toast.error("Erro ao carregar livros");
    } finally {
      setLoading(false);
    }
  };

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 mb-8 aura-soft"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Minha Biblioteca
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="aura-soft transition-aura"
              onClick={() => navigate("/profile")}
            >
              <User className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="aura-soft transition-aura"
              onClick={signOut}
            >
              Sair
            </Button>
          </div>
        </div>

        {/* Premium button and book count */}
        <div className="flex items-center justify-between mb-4">
          {subscriptionTier === "free" && (
            <Button
              variant="outline"
              size="sm"
              className="aura-soft transition-aura border-accent hover:bg-accent/10"
              onClick={() => navigate("/pricing")}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Assinar Premium
            </Button>
          )}
          <p className="text-sm text-muted-foreground ml-auto">
            {books.length} livros na sua coleção • Plano {subscriptionTier === "free" ? "Gratuito" : subscriptionTier === "pro" ? "Pro" : "Premium"}
          </p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar livros ou autores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 glass border-primary/20 focus:border-primary"
          />
        </div>
      </motion.header>

      {/* Books grid */}
      {loading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredBooks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <p className="text-muted-foreground text-lg mb-4">
            {searchQuery ? "Nenhum livro encontrado" : "Sua biblioteca está vazia"}
          </p>
          {!searchQuery && (
            <p className="text-sm text-muted-foreground">
              Clique no botão abaixo para adicionar seu primeiro PDF
            </p>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8"
        >
          {filteredBooks.map((book, index) => (
            <BookCard key={book.id} book={book} index={index} onDelete={loadBooks} />
          ))}
        </motion.div>
      )}

      {/* Upload button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.4, type: "spring" }}
        className="fixed bottom-8 right-8"
      >
        <UploadPDF onUploadComplete={loadBooks} />
      </motion.div>

      <SubscriptionDialog
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
      />
    </div>
  );
};

export default Library;