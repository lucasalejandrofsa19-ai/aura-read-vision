import { useState, useEffect, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { Search, User, CreditCard, Shield, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useBooks } from "@/hooks/useBooks";
import BookCard from "@/components/BookCard";
import UploadPDF from "@/components/UploadPDF";
import { UploadPremiumBook } from "@/components/UploadPremiumBook";
import SubscriptionDialog from "@/components/SubscriptionDialog";
import { PWAInstallDialog } from "@/components/PWAInstallDialog";
import { LibraryTour } from "@/components/LibraryTour";
import { FeedbackDialog } from "@/components/FeedbackDialog";

// Memoizar BookCard para evitar re-renders desnecessários
const MemoizedBookCard = memo(BookCard);

const Library = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const { user, signOut, subscriptionTier } = useAuth();
  const { isAdmin, hasPremiumAccess } = useUserData();
  const { books, premiumBooks, isLoading } = useBooks();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  // Memoizar livros premium com flag
  const premiumBooksWithFlag = useMemo(() => 
    premiumBooks.map(book => ({
      ...book,
      isPremiumBook: true,
      progress: 0,
    })),
    [premiumBooks]
  );

  // Memoizar filtro de livros
  const filteredBooks = useMemo(() => 
    books.filter(
      (book) =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
    [books, searchQuery]
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
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Premium Books Section */}
          {hasPremiumAccess && premiumBooksWithFlag.length > 0 && (
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
                {premiumBooksWithFlag.map((book, index) => (
                  <MemoizedBookCard 
                    key={book.id} 
                    book={book} 
                    index={index} 
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
              {(hasPremiumAccess && premiumBooksWithFlag.length > 0) && (
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
                  <MemoizedBookCard 
                    key={book.id} 
                    book={book} 
                    index={index} 
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
        <UploadPDF />
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