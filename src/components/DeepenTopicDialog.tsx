import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Video, FileText, Sparkles, ExternalLink, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Suggestions {
  topics?: string[];
  articles?: { title: string; description: string; searchQuery: string }[];
  videos?: { title: string; description: string; searchQuery: string }[];
  books?: { title: string; author: string; description: string }[];
  questions?: string[];
}

interface Props {
  summary: string;
  bookTitle?: string;
  trigger: React.ReactNode;
}

export const DeepenTopicDialog = ({ summary, bookTitle, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Suggestions | null>(null);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (next && !data && !loading) {
      await fetchSuggestions();
    }
  };

  const fetchSuggestions = async () => {
    if (!summary || summary.trim().length < 30) {
      toast.error("Gere um resumo primeiro para poder aprofundar o tópico");
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("deepen-topic", {
        body: { summary, bookTitle },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao buscar sugestões");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const googleScholar = (q: string) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`;
  const youtube = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  const googleBooks = (q: string) => `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(q)}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Aprofundar Tópico
          </DialogTitle>
          <DialogDescription>
            Recursos sugeridos pela IA para você se aprofundar nos temas do resumo.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando temas e buscando recursos...</p>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-6">
            {data.topics && data.topics.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-sm">Temas centrais</h3>
                <div className="flex flex-wrap gap-2">
                  {data.topics.map((t, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.articles && data.articles.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4" /> Artigos e estudos
                </h3>
                <div className="space-y-2">
                  {data.articles.map((a, i) => (
                    <a
                      key={i}
                      href={googleScholar(a.searchQuery || a.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm group-hover:text-primary">{a.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {data.videos && data.videos.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                  <Video className="w-4 h-4" /> Vídeos recomendados
                </h3>
                <div className="space-y-2">
                  {data.videos.map((v, i) => (
                    <a
                      key={i}
                      href={youtube(v.searchQuery || v.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm group-hover:text-primary">{v.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {data.books && data.books.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4" /> Livros relacionados
                </h3>
                <div className="space-y-2">
                  {data.books.map((b, i) => (
                    <a
                      key={i}
                      href={googleBooks(`${b.title} ${b.author}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm group-hover:text-primary">{b.title}</p>
                          <p className="text-xs text-primary/80 mt-0.5">{b.author}</p>
                          <p className="text-xs text-muted-foreground mt-1">{b.description}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {data.questions && data.questions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                  <HelpCircle className="w-4 h-4" /> Perguntas para reflexão
                </h3>
                <ul className="space-y-2">
                  {data.questions.map((q, i) => (
                    <li key={i} className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/40 border-l-2 border-primary/40">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={fetchSuggestions} className="w-full gap-2">
              <Sparkles className="w-4 h-4" /> Gerar novas sugestões
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
