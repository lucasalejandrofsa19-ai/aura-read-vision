import { SEO } from "@/components/SEO";
import { useInvalidateUserProfile } from "@/hooks/useInvalidateUserProfile";
import { useState, useEffect, useMemo, memo, useRef, useId, lazy, Suspense } from "react";
const FloatingBook3D = lazy(() => import("@/components/FloatingBook3D"));
import { motion, useReducedMotion } from "framer-motion";
import { Search, User, CreditCard, Shield, ChevronLeft, ChevronRight, GraduationCap, HelpCircle, BookOpen, RotateCcw, FileText, ExternalLink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useBooks } from "@/hooks/useBooks";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import BookCard from "@/components/BookCard";
import UploadPDF, { type UploadPDFHandle } from "@/components/UploadPDF";
import { UploadPremiumBook } from "@/components/UploadPremiumBook";
import SubscriptionDialog from "@/components/SubscriptionDialog";
import { PWAInstallDialog } from "@/components/PWAInstallDialog";
import { LibraryTour } from "@/components/LibraryTour";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { LazyLoadWrapper } from "@/components/LazyLoadWrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumBadge } from "@/components/PremiumBadge";
import { DailyGoalCard } from "@/components/gamification/DailyGoalCard";
import { ReadingInsightsCard } from "@/components/ReadingInsightsCard";
import { AuthDialog } from "@/components/AuthDialog";
import { LogIn } from "lucide-react";
import LibraryCTA from "@/components/LibraryCTA";
import { TourTargetsProvider, useTourTarget } from "@/contexts/TourTargetsContext";
import { matchesSearch } from "@/lib/searchNormalize";
import { PUBLIC_PDFS_LABEL, PUBLIC_PDFS_TOOLTIP, PUBLIC_PDFS_DESCRIPTION } from "@/lib/publicPdfs";


// Memoizar BookCard para evitar re-renders desnecessários
const MemoizedBookCard = memo(BookCard);

const LibraryInner = () => {
  const profileButtonRef = useTourTarget("profile-button");
  const searchBarRef = useTourTarget("search-bar");
  const bookCardRef = useTourTarget("book-card");
  const uploadButtonRef = useTourTarget("upload-button");
  const publicPdfsDescId = useId();
  const prefersReducedMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState("");
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isAdmin, hasPremiumAccess } = useUserData();
  const { books, premiumBooks, isLoading } = useBooks();
  const navigate = useNavigate();
  const invalidateProfile = useInvalidateUserProfile();

  // Estado derivado — sem useEffect: dialog de auth abre sempre que não há user.
  const authDialogOpen = !user;
  const setAuthDialogOpen = (_open: boolean) => {
    // No-op intencional: o dialog é puramente reativo ao estado de auth.
    // Mantido para compatibilidade com o controlled prop do AuthDialog.
  };

  // Refs for scroll containers
  const userBooksScrollRef = useRef<HTMLDivElement>(null);
  const uploadPDFRef = useRef<UploadPDFHandle>(null);

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
    onSwipeLeft: () => scrollRight(userBooksScrollRef),
    onSwipeRight: () => scrollLeft(userBooksScrollRef),
    threshold: 50,
  });


  // Livros premium gratuitos exibidos junto com os do usuário
  const freePremiumBooks = useMemo(
    () =>
      premiumBooks
        .filter((b: any) => b.is_free)
        .map((book) => ({ ...book, isPremiumBook: true, progress: 0 })),
    [premiumBooks]
  );

  // Lista unificada: livros do usuário + livros premium gratuitos
  const allBooks = useMemo(
    () => [...freePremiumBooks, ...books],
    [freePremiumBooks, books]
  );

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return allBooks;
    return allBooks.filter(
      (book) =>
        matchesSearch(book.title, q) ||
        matchesSearch((book as any).author, q)
    );
  }, [allBooks, searchQuery]);


  return (
    <>
    <SEO
      title="Minha Biblioteca — AURA READ"
      description="Acesse, organize e leia seus PDFs em um só lugar. Faça upload de novos livros e continue de onde parou."
      path="/library"
    />
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20"
         style={{
           backgroundImage: `radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.05), transparent 50%)`
         }}
    >
    <div className="mx-auto w-full max-w-screen-2xl p-3 sm:p-6 lg:p-8 xl:p-10">

      {/* Header */}
      <motion.header
        initial={prefersReducedMotion ? false : { opacity: 0, y: -20 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-lg shadow-background/40 p-5 sm:p-6 mb-6 sm:mb-8 overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

        <div className="relative flex items-center justify-between gap-3 mb-5 sm:mb-6 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
              Minha Biblioteca
            </h1>
            <div className="flex gap-2">
              {isAdmin && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/30">
                  <Shield className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs font-semibold text-accent">Admin</span>
                </div>
              )}
              {hasPremiumAccess && !isAdmin && (
                <PremiumBadge variant="compact" />
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="aura-soft transition-aura"
                  title="Ajuda"
                  aria-label="Ajuda">
                  <HelpCircle className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass w-56">
                <DropdownMenuItem onClick={() => navigate("/guia")}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Guia de uso
                </DropdownMenuItem>
                <DropdownMenuItem title={PUBLIC_PDFS_TOOLTIP} aria-label={PUBLIC_PDFS_TOOLTIP} aria-describedby={publicPdfsDescId} onClick={() => window.open("/pdfs-publicos", "_blank", "noopener,noreferrer")}>
                  <FileText className="w-4 h-4 mr-2" />
                  {PUBLIC_PDFS_LABEL}
                  <ExternalLink className="w-3 h-3 ml-auto opacity-60" aria-hidden="true" />
                  <span id={publicPdfsDescId} className="sr-only">{PUBLIC_PDFS_DESCRIPTION}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    if (!user) return;
                    const { error } = await supabase
                      .from("profiles")
                      .update({ has_seen_library_tour: false })
                      .eq("id", user.id);
                    if (error) {
                      toast.error("Não foi possível reiniciar o tour");
                      return;
                    }
                    await invalidateProfile();
                    window.dispatchEvent(new CustomEvent("library-tour:restart"));
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Rever tour
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="aura-soft transition-aura"
              onClick={() => navigate("/resumo-academico")}
              title="Resumo Acadêmico"
             aria-label="Resumo acadêmico">
              <GraduationCap className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="aura-soft transition-aura"
              onClick={() => navigate("/profile")}
              ref={profileButtonRef}
             aria-label="Perfil">
              <User className="w-5 h-5" />
            </Button>
            {user ? (
              <Button
                variant="ghost"
                size="icon"
                className="aura-soft transition-aura"
                onClick={signOut}
                title="Sair"
               aria-label="Sair">
                Sair
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="aura-soft transition-aura"
                onClick={() => setAuthDialogOpen(true)}
                title="Entrar"
               aria-label="Entrar">
                <LogIn className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Premium button, admin button and book count */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
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
            {true && (
              <div className="flex flex-col gap-2">
                <Button
                  variant="premium"
                  size="sm"
                  onClick={() => navigate("/pricing")}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Assinar Premium
                </Button>
                <FeedbackDialog />
              </div>
            )}
            {false && !isAdmin && (
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
          <p className="text-xs sm:text-sm text-muted-foreground ml-auto">
            {books.length} livros na sua coleção
          </p>
        </div>

        {/* Search bar */}
        <div className="relative group" ref={searchBarRef}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar por título ou autor…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 pl-10 pr-4 rounded-xl bg-background/60 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60 transition-all"
          />
        </div>
      </motion.header>

      {/* Layout desktop-first: sidebar (lg+) + conteúdo principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto scrollbar-hide">
          <div className="reveal-on-scroll reveal-left"><DailyGoalCard /></div>
          <div className="reveal-on-scroll reveal-left reveal-delay-2"><ReadingInsightsCard /></div>
          
        </aside>

        {/* Conteúdo principal */}
        <main className="lg:col-span-8 xl:col-span-9">


      {/* Books grid */}
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Books Section */}
          {filteredBooks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12"
            >
              {searchQuery ? (
                <p className="text-center text-muted-foreground text-lg">
                  Nada por aqui. Tente outro termo.
                </p>
              ) : books.length === 0 ? (
                <LibraryCTA
                  variant="empty-state"
                  onAction={() => uploadPDFRef.current?.openPicker()}
                />
              ) : (
                <p className="text-center text-muted-foreground text-lg">
                  Nenhum livro corresponde ao filtro atual.
                </p>
              )}
            </motion.div>
          ) : (
            <>
              {/* Card destacado: PDFs Públicos */}
              <motion.button
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                onClick={() => window.open("/pdfs-publicos", "_blank", "noopener,noreferrer")}
                aria-label={PUBLIC_PDFS_TOOLTIP}
                aria-describedby={publicPdfsDescId}
                className="reveal-on-scroll reveal-zoom w-full mb-6 group relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-5 text-left transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20"
              >
                <span id={publicPdfsDescId} className="sr-only">{PUBLIC_PDFS_DESCRIPTION}</span>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-base flex items-center gap-2">
                      {PUBLIC_PDFS_LABEL}
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      Catálogo gratuito — acesso aberto a todos os usuários
                    </p>
                  </div>
                </div>
              </motion.button>

              <div className="reveal-on-scroll flex items-end justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">Meus Livros</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filteredBooks.length} {filteredBooks.length === 1 ? "título" : "títulos"} disponíveis
                  </p>
                </div>
              </div>
              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 lg:gap-6 mb-8"
              >
                {filteredBooks.map((book, index) => (
                  <div
                    key={book.id}
                    ref={index === 0 ? bookCardRef : undefined}
                    className={`reveal-on-scroll reveal-zoom reveal-delay-${(index % 4) + 1}`}
                  >
                    <LazyLoadWrapper
                      minHeight="320px"
                      rootMargin="200px"
                      fallback={
                        <div className="space-y-2">
                          <Skeleton className="h-72 w-full rounded-xl" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      }
                    >
                      <MemoizedBookCard
                        book={book}
                        index={index}
                        isPremiumBook={(book as any).isPremiumBook === true}
                        isAdmin={isAdmin}
                      />
                    </LazyLoadWrapper>
                  </div>
                ))}
              </div>
            </>
          )}

        </>
      )}
        </main>
      </div>

      {/* Upload button */}
      <motion.div
        initial={prefersReducedMotion ? false : { scale: 0 }}
        animate={prefersReducedMotion ? undefined : { scale: 1 }}
        transition={prefersReducedMotion ? undefined : { delay: 0.4, type: "spring" }}
        className="fixed bottom-8 right-8"
        ref={uploadButtonRef}
      >
        <UploadPDF ref={uploadPDFRef} />
      </motion.div>

      {subscriptionDialogOpen && (
        <SubscriptionDialog
          open={subscriptionDialogOpen}
          onOpenChange={setSubscriptionDialogOpen}
        />
      )}

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

      <LibraryTour />
    </div>
    </div>
    </>

  );
};

const Library = () => (
  <TourTargetsProvider>
    <LibraryInner />
  </TourTargetsProvider>
);

export default Library;