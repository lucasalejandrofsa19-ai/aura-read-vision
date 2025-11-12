import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Share2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const mockHighlights = [
  {
    id: "1",
    text: "A tecnologia trouxe consigo não apenas a digitalização do conteúdo, mas também novas formas de interação.",
    color: "bg-primary/20 border-primary",
    page: 12,
  },
  {
    id: "2",
    text: "Quando destacamos um trecho de texto, não estamos apenas marcando palavras. Estamos criando uma conexão pessoal com o conteúdo.",
    color: "bg-accent/20 border-accent",
    page: 15,
  },
  {
    id: "3",
    text: "A leitura é para a mente o que o exercício é para o corpo.",
    color: "bg-primary/20 border-primary",
    page: 23,
  },
  {
    id: "4",
    text: "À medida que avançamos nesta era digital, lembremo-nos de que a essência da leitura permanece a mesma.",
    color: "bg-accent/20 border-accent",
    page: 28,
  },
];

const Summary = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBook();
    }
  }, [id]);

  const fetchBook = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setBook(data);
    } catch (error) {
      console.error('Error fetching book:', error);
      toast.error('Failed to load book');
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    if (!id) return;
    
    if (!session) {
      toast.error('Please log in to generate summaries');
      return;
    }
    
    try {
      setGenerating(true);
      toast.info('Generating AI summary...');

      const { data, error } = await supabase.functions.invoke('generate-summary', {
        body: { bookId: id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast.success('Summary generated successfully!');
      await fetchBook(); // Refresh to get the new summary
    } catch (error: any) {
      console.error('Error generating summary:', error);
      toast.error(error.message || 'Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = () => {
    toast.success("Resumo exportado com sucesso!");
  };

  const handleShare = () => {
    navigate(`/share/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                AI Summary
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {book?.title || 'Loading...'}
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
      <div className="max-w-4xl mx-auto">
        {book?.summary ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8 aura-soft"
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">AI-Generated Summary</h2>
            </div>
            <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {book.summary}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-12 text-center"
          >
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary/50" />
            <h3 className="text-xl font-semibold mb-3">No Summary Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Generate an AI-powered summary of this book using Lovable AI. 
              Get key insights, main themes, and important takeaways.
            </p>
            <Button 
              onClick={generateSummary} 
              disabled={generating || !book?.extracted_text}
              className="aura-soft transition-aura"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Summary
                </>
              )}
            </Button>
            {!book?.extracted_text && (
              <p className="text-xs text-muted-foreground mt-3">
                Text extraction required before generating summary
              </p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Summary;