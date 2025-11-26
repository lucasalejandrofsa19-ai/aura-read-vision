import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Book, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { pdf } from "@react-pdf/renderer";
import { HighlightsPDFDocument } from "./HighlightsPDFDocument";
import { captureError } from "@/lib/sentry";
import { motion } from "framer-motion";

interface Highlight {
  id: string;
  page_number: number;
  text: string;
  color: string | null;
  created_at: string;
}

interface BookWithHighlights {
  id: string;
  title: string;
  author: string | null;
  highlights: Highlight[];
}

export const ProfileHighlights = () => {
  const { user } = useAuth();
  const [booksWithHighlights, setBooksWithHighlights] = useState<BookWithHighlights[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadHighlights();
    }
  }, [user]);

  const loadHighlights = async () => {
    if (!user) return;

    try {
      const { data: highlights, error: highlightsError } = await supabase
        .from("highlights")
        .select("*, books(id, title, author)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (highlightsError) throw highlightsError;

      // Group highlights by book
      const grouped = highlights?.reduce((acc: Record<string, BookWithHighlights>, highlight: any) => {
        const bookId = highlight.books.id;
        if (!acc[bookId]) {
          acc[bookId] = {
            id: bookId,
            title: highlight.books.title,
            author: highlight.books.author,
            highlights: [],
          };
        }
        acc[bookId].highlights.push(highlight);
        return acc;
      }, {});

      setBooksWithHighlights(Object.values(grouped || {}));
    } catch (error) {
      captureError(error, { context: "load_profile_highlights" });
      toast.error("Erro ao carregar destaques");
    } finally {
      setLoading(false);
    }
  };

  const downloadHighlightsAsPDF = async (book: BookWithHighlights) => {
    try {
      toast.loading("Gerando PDF...");
      
      const doc = <HighlightsPDFDocument highlights={book.highlights} bookTitle={book.title} />;
      const blob = await pdf(doc).toBlob();
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `destaques-${book.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
      link.click();
      
      URL.revokeObjectURL(url);
      toast.dismiss();
      toast.success("PDF baixado com sucesso!");
    } catch (error) {
      toast.dismiss();
      captureError(error, { context: "download_highlights_pdf" });
      toast.error("Erro ao gerar PDF");
    }
  };

  const deleteHighlight = async (highlightId: string, bookId: string) => {
    try {
      const { error } = await supabase
        .from("highlights")
        .delete()
        .eq("id", highlightId);

      if (error) throw error;

      setBooksWithHighlights((prev) =>
        prev
          .map((book) =>
            book.id === bookId
              ? { ...book, highlights: book.highlights.filter((h) => h.id !== highlightId) }
              : book
          )
          .filter((book) => book.highlights.length > 0)
      );

      toast.success("Destaque removido!");
    } catch (error) {
      captureError(error, { context: "delete_highlight" });
      toast.error("Erro ao remover destaque");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Carregando destaques...</p>
        </CardContent>
      </Card>
    );
  }

  if (booksWithHighlights.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Você ainda não tem destaques salvos.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {booksWithHighlights.map((book) => (
        <Card key={book.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Book className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{book.title}</CardTitle>
                  {book.author && (
                    <p className="text-sm text-muted-foreground mt-1">{book.author}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadHighlightsAsPDF(book)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedBook(expandedBook === book.id ? null : book.id)}
                >
                  {expandedBook === book.id ? "Ocultar" : "Ver"} ({book.highlights.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {expandedBook === book.id && (
            <CardContent>
              <div className="space-y-3">
                {book.highlights.map((highlight, index) => (
                  <motion.div
                    key={highlight.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 bg-muted/50 rounded-lg relative group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        Página {highlight.page_number}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(highlight.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteHighlight(highlight.id, book.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm">{highlight.text}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};