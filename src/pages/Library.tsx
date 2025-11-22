import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, User, CreditCard, Shield, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import BookCard from "@/components/BookCard";
import UploadPDF from "@/components/UploadPDF";
import { UploadPremiumBook } from "@/components/UploadPremiumBook";
import SubscriptionDialog from "@/components/SubscriptionDialog";
import { PWAInstallDialog } from "@/components/PWAInstallDialog";
import { LibraryTour } from "@/components/LibraryTour";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";

const Library = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [books, setBooks] = useState<any[]>([]);
  const [premiumBooks, setPremiumBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const { user, signOut, subscriptionTier, checkSubscription } = useAuth();
  const { isAdmin, hasPremiumAccess } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    loadBooks();
    loadPremiumBooks();
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

  const loadPremiumBooks = async () => {
    if (!user || !hasPremiumAccess) return;

    try {
      const { data, error } = await supabase
        .from("premium_books")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Adicionar flag para identificar como livro premium
      const premiumBooksWithFlag = (data || []).map(book => ({
        ...book,
        isPremiumBook: true,
      }));
      
      setPremiumBooks(premiumBooksWithFlag);
    } catch (error) {
      console.error("Error loading premium books:", error);
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Minha Biblioteca
            </h1>
            <div className="flex gap-2">
              {isAdmin && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30">
                  <Shield className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-red-500">Admin</span>
                </div>
              )}
              {hasPremiumAccess && !isAdmin && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                  <Crown className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-semibold text-purple-500">Premium</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="aura-soft transition-aura"
              onClick={() => navigate("/profile")}
              data-tour="profile-button"
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

        {/* Premium button, admin button and book count */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="aura-soft transition-aura border-primary hover:bg-primary/10"
                  onClick={() => navigate("/admin")}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Painel Admin
                </Button>
                <UploadPremiumBook />
              </>
            )}
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
            <FeedbackDialog />
            <PWAInstallDialog>
              <button className="hover-scale transition-all duration-300 hover:shadow-lg active:scale-95">
                <img 
                  src="/icon-512.png" 
                  alt="AURA READ - Clique para ver opções de instalação" 
                  className="w-10 h-10 rounded-lg shadow-md cursor-pointer"
                  title="Instalar AURA READ"
                />
              </button>
            </PWAInstallDialog>
          </div>
          <p className="text-sm text-muted-foreground ml-auto">
            {books.length} livros na sua coleção • Plano {subscriptionTier === "free" ? "Gratuito" : subscriptionTier === "pro" ? "Pro" : "Premium"}
          </p>
        </div>

        {/* Search bar */}
        <div className="relative" data-tour="search-bar">
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
      ) : (
        <>
          {/* Premium Books Section */}
          {hasPremiumAccess && premiumBooks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Biblioteca Premium</h2>
                  <p className="text-sm text-muted-foreground">
                    Livros exclusivos para assinantes premium
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {premiumBooks.map((book, index) => (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    index={index} 
                    onDelete={loadPremiumBooks}
                    onReprocess={loadPremiumBooks}
                    isPremiumBook={true}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* User Books Section */}
          {filteredBooks.length === 0 ? (
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
            <>
              {(hasPremiumAccess && premiumBooks.length > 0) && (
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-2xl font-bold">Meus Livros</h2>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8"
              >
                {filteredBooks.map((book, index) => (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    index={index} 
                    onDelete={loadBooks}
                    data-tour={index === 0 ? "book-card" : undefined}
                  />
                ))}
              </motion.div>
            </>
          )}
        </>
      )}

      {/* Upload button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.4, type: "spring" }}
        className="fixed bottom-8 right-8"
        data-tour="upload-button"
      >
        <UploadPDF onUploadComplete={loadBooks} />
      </motion.div>

      <SubscriptionDialog
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
      />

      <LibraryTour />
    </div>
  );
};

export default Library;