import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Share2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Highlight } from "@/hooks/useHighlights";
import { ExportDialog } from "@/components/ExportDialog";
import { HighlightImageDialog } from "@/components/HighlightImageDialog";

const Summary = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string>("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [bookTitle, setBookTitle] = useState<string>("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    loadHighlights();
  }, [id]);

  const loadHighlights = async () => {
    if (!id) return;

    try {
      const { data: bookData, error: bookError } = await supabase
        .from("books")
        .select("title")
        .eq("id", id)
        .single();

      if (bookError) throw bookError;
      setBookTitle(bookData.title);

      const { data, error } = await supabase
        .from("highlights")
        .select("*")
        .eq("book_id", id)
        .order("page_number", { ascending: true });

      if (error) throw error;
      setHighlights((data || []) as Highlight[]);
    } catch (error) {
      console.error("Erro ao carregar destaques:", error);
      toast.error("Erro ao carregar destaques");
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    if (highlights.length === 0) {
      toast.error("Não há destaques para resumir");
      return;
    }

    setGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-highlights", {
        body: { highlights },
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast.error("Limite de requisições excedido. Tente novamente mais tarde.");
        } else if (error.message?.includes("402")) {
          toast.error("Créditos insuficientes. Adicione créditos ao seu workspace.");
        } else {
          toast.error("Erro ao gerar resumo");
        }
        console.error("Erro:", error);
        return;
      }

      setSummary(data.summary);
      toast.success("Resumo gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar resumo:", error);
      toast.error("Erro ao gerar resumo");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const handleShare = () => {
    navigate(`/share/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 mb-8 aura-soft"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/reader/${id}`)}
              className="aura-soft transition-aura"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Resumo e Marcações
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {highlights.length} trechos destacados
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExport}
              className="aura-soft transition-aura"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="aura-soft transition-aura"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* AI Summary Section */}
      {highlights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-8"
        >
          <div className="glass rounded-xl p-6 border-l-4 border-primary">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Resumo Inteligente
              </h2>
              {!summary && (
                <Button
                  onClick={generateSummary}
                  disabled={generatingSummary}
                  className="gap-2"
                >
                  {generatingSummary ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Gerar Resumo
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {summary ? (
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
                <Button
                  onClick={generateSummary}
                  disabled={generatingSummary}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  {generatingSummary ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Gerando...
                    </>
                  ) : (
                    "Gerar Novo Resumo"
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Clique em "Gerar Resumo" para criar um resumo inteligente dos seus destaques usando IA
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Highlights list */}
      <div className="max-w-4xl mx-auto space-y-4">
        <h2 className="text-lg font-semibold mb-4">Seus Destaques</h2>
        {highlights.map((highlight, index) => (
          <motion.div
            key={highlight.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass rounded-xl p-6 border-l-4 hover:aura-soft transition-aura cursor-pointer"
            style={{ borderLeftColor: highlight.color }}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-muted-foreground">Página {highlight.page_number}</span>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: highlight.color }}
              />
            </div>
            {highlight.text ? (
              <div>
                <p className="text-foreground leading-relaxed mb-4">{highlight.text}</p>
                
                <HighlightImageDialog 
                  text={highlight.text} 
                  highlightId={highlight.id}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-2">
                      <Sparkles className="w-4 h-4" />
                      Gerar Imagem
                    </Button>
                  }
                />
              </div>
            ) : (
              <p className="text-muted-foreground italic text-sm">
                Destaque visual (sem texto extraído)
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {highlights.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-12 text-center max-w-2xl mx-auto"
        >
          <p className="text-muted-foreground">
            Você ainda não fez nenhuma marcação neste livro.
            <br />
            Comece destacando trechos importantes durante a leitura!
          </p>
        </motion.div>
      )}

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        bookTitle={bookTitle}
        highlights={highlights}
        notes={summary ? [{ 
          id: "summary", 
          note_text: summary, 
          page_number: 1,
          book_id: id!,
          user_id: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }] : []}
      />
    </div>
  );
};

export default Summary;
