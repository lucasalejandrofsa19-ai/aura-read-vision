import { useState, useEffect, useMemo, memo, useRef } from "react";
import { motion } from "framer-motion";
import { Search, User, CreditCard, Shield, Crown, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useBooks } from "@/hooks/useBooks";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
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
  
  // Refs for scroll containers
  const premiumScrollRef = useRef<HTMLDivElement>(null);
  const userBooksScrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<'premium' | 'user'>('user');

  const scrollLeft = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // Setup swipe gestures
  useSwipeGesture({
    onSwipeLeft: () => {
      if (activeSection === 'premium') {
        scrollRight(premiumScrollRef);
      } else {
        scrollRight(userBooksScrollRef);
      }
    },
    onSwipeRight: () => {
      if (activeSection === 'premium') {
        scrollLeft(premiumScrollRef);
      } else {
        scrollLeft(userBooksScrollRef);
      }
    },
    threshold: 50,
  });

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
    <div className="min-h-screen p-6 bg-gradient-to-b from-background via-background to-muted/20"
         style={{
           backgroundImage: `radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.05), transparent 50%)`
         }}
    >
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
                <FeedbackDialog />
              </>
            )}
            {subscriptionTier === "free" && (
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="aura-soft transition-aura border-accent hover:bg-accent/10"
                  onClick={() => navigate("/pricing")}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Assinar Premium
                </Button>
                <FeedbackDialog />
              </div>
            )}
            {subscriptionTier !== "free" && !isAdmin && (
              <FeedbackDialog />
            )}
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
              <div className="relative mb-12">
                {/* Wooden shelf effect */}
                <div className="absolute -bottom-4 left-0 right-0 h-6 bg-gradient-to-b from-amber-800/30 to-amber-900/40 rounded-lg shadow-xl border-t border-amber-700/50" />
                <div className="absolute -bottom-2 left-0 right-0 h-3 bg-gradient-to-b from-amber-900/20 to-transparent rounded-lg" />
                
                {/* Navigation buttons */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-full shadow-lg"
                  onClick={() => scrollLeft(premiumScrollRef)}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-full shadow-lg"
                  onClick={() => scrollRight(premiumScrollRef)}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
                
                {/* Books on shelf */}
                <div 
                  ref={premiumScrollRef} 
                  className="flex gap-4 overflow-x-auto pb-8 px-2 scrollbar-hide"
                  onMouseEnter={() => setActiveSection('premium')}
                  onTouchStart={() => setActiveSection('premium')}
                >
                  {premiumBooksWithFlag.map((book, index) => (
                    <div key={book.id} className="flex-shrink-0 w-48">
                      <MemoizedBookCard 
                        book={book} 
                        index={index} 
                        isPremiumBook={true}
                        isAdmin={isAdmin}
                      />
                    </div>
                  ))}
                </div>
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
                className="relative"
              >
                {/* Wooden shelf effect */}
                <div className="absolute -bottom-4 left-0 right-0 h-6 bg-gradient-to-b from-amber-800/30 to-amber-900/40 rounded-lg shadow-xl border-t border-amber-700/50" />
                <div className="absolute -bottom-2 left-0 right-0 h-3 bg-gradient-to-b from-amber-900/20 to-transparent rounded-lg" />
                
                {/* Navigation buttons */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-full shadow-lg"
                  onClick={() => scrollLeft(userBooksScrollRef)}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-full shadow-lg"
                  onClick={() => scrollRight(userBooksScrollRef)}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
                
                {/* Books on shelf */}
                <div 
                  ref={userBooksScrollRef} 
                  className="flex gap-4 overflow-x-auto pb-8 px-2 scrollbar-hide mb-8"
                  onMouseEnter={() => setActiveSection('user')}
                  onTouchStart={() => setActiveSection('user')}
                >
                  {filteredBooks.map((book, index) => (
                    <div key={book.id} className="flex-shrink-0 w-48">
                      <MemoizedBookCard 
                        book={book} 
                        index={index} 
                        data-tour={index === 0 ? "book-card" : undefined}
                      />
                    </div>
                  ))}
                </div>
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