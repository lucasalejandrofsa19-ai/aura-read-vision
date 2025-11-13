import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Bookmark,
  Palette,
  FileText,
  Share2,
  BookmarkCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PDFViewer } from "@/components/PDFViewer";
import { captureError } from "@/lib/sentry";


const Reader = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [backgroundColor, setBackgroundColor] = useState("bg-background");
  const [bookmarkedPage, setBookmarkedPage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string>("");

  useEffect(() => {
    loadBook();
  }, [id]);

  const loadBook = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setBook(data);
      
      // Set current page from database
      if (data.current_page) {
        setCurrentPage(data.current_page);
      }

      // Get public URL for the PDF
      if (data.file_path) {
        const { data: urlData } = supabase.storage
          .from("pdfs")
          .getPublicUrl(data.file_path);
        
        setPdfUrl(urlData.publicUrl);
      }
    } catch (error) {
      captureError(error, { context: "load_book" });
      toast.error("Erro ao carregar livro");
      navigate("/library");
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentPage = async (page: number) => {
    if (!id) return;
    
    try {
      const { error } = await supabase
        .from("books")
        .update({ current_page: page })
        .eq("id", id);
      
      if (error) throw error;
    } catch (error) {
      captureError(error, { context: "save_current_page" });
    }
  };

  const backgrounds = [
    { name: "Grafite", class: "bg-background", color: "Escuro" },
    { name: "Papel Velho", class: "bg-paper", color: "Claro" },
    { name: "Safira", class: "bg-card", color: "Azul" },
    { name: "Âmbar", class: "bg-amber-950", color: "Âmbar" },
  ];

  const handleBookmark = () => {
    if (bookmarkedPage === currentPage) {
      // Remove bookmark
      setBookmarkedPage(null);
      toast.success("Marcador removido");
    } else {
      // Set bookmark to current page
      setBookmarkedPage(currentPage);
      toast.success(`Página ${currentPage} marcada!`);
    }
  };

  const goToBookmark = () => {
    if (bookmarkedPage) {
      setCurrentPage(bookmarkedPage);
      saveCurrentPage(bookmarkedPage);
      toast.success(`Indo para página marcada: ${bookmarkedPage}`);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    saveCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!book) return null;

  return (
    <div className={`min-h-screen ${backgroundColor} transition-colors duration-500`}>
      {/* Toolbar */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass sticky top-0 z-50 border-b border-border/50"
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/library")}
              className="aura-soft transition-aura"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">{book.title}</h1>
              <p className="text-xs text-muted-foreground">{book.author || "Autor Desconhecido"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`transition-aura ${bookmarkedPage ? "text-accent aura-amber" : "aura-soft"}`}
                >
                  {bookmarkedPage ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass">
                <DropdownMenuItem onClick={handleBookmark}>
                  {bookmarkedPage === currentPage ? "Remover marcador" : "Marcar página atual"}
                </DropdownMenuItem>
                {bookmarkedPage && bookmarkedPage !== currentPage && (
                  <DropdownMenuItem onClick={goToBookmark}>
                    Ir para página {bookmarkedPage}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="aura-soft transition-aura">
                  <Palette className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass">
                {backgrounds.map((bg) => (
                  <DropdownMenuItem
                    key={bg.name}
                    onClick={() => setBackgroundColor(bg.class)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded ${bg.class} border border-border`} />
                      <span>{bg.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/summary/" + id)}
              className="aura-soft transition-aura"
            >
              <FileText className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/share/" + id)}
              className="aura-soft transition-aura"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-5xl mx-auto px-6 py-12"
      >
        {pdfUrl ? (
          <PDFViewer 
            fileUrl={pdfUrl} 
            initialPage={currentPage}
            onPageChange={handlePageChange}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum arquivo PDF disponível</p>
          </div>
        )}
      </motion.main>
    </div>
  );
};

export default Reader;