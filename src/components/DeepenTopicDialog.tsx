import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, BookOpen, Video, FileText, Sparkles, ExternalLink, HelpCircle, Pencil, Check, X, Plus, RefreshCw } from "lucide-react";
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
  const [topics, setTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [newTopic, setNewTopic] = useState("");

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (next && !data && !loading) {
      await fetchSuggestions();
    }
  };

  const fetchSuggestions = async (customTopic?: string) => {
    if (!summary || summary.trim().length < 30) {
      toast.error("Gere um resumo primeiro para poder aprofundar o tópico");
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("deepen-topic", {
        body: { summary, bookTitle, topic: customTopic },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setData(result);
      const t: string[] = Array.isArray(result?.topics) ? result.topics : [];
      setTopics(t);
      setSelected(new Set(t.map((_, i) => i)));
      setEditingIdx(null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao buscar sugestões");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (i: number) => {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelected(next);
  };

  const startEdit = (i: number) => {
    setEditingIdx(i);
    setDraft(topics[i]);
  };
  const saveEdit = () => {
    if (editingIdx === null) return;
    const v = draft.trim();
    if (!v) return;
    setTopics(topics.map((t, i) => (i === editingIdx ? v : t)));
    setEditingIdx(null);
  };
  const removeTopic = (i: number) => {
    setTopics(topics.filter((_, idx) => idx !== i));
    const next = new Set<number>();
    selected.forEach((s) => {
      if (s < i) next.add(s);
      else if (s > i) next.add(s - 1);
    });
    setSelected(next);
  };
  const addTopic = () => {
    const v = newTopic.trim();
    if (!v) return;
    const next = [...topics, v];
    setTopics(next);
    setSelected(new Set([...selected, next.length - 1]));
    setNewTopic("");
  };

  const regenerateWithSelected = async () => {
    const chosen = topics.filter((_, i) => selected.has(i));
    if (chosen.length === 0) {
      toast.error("Selecione ou crie ao menos um tópico");
      return;
    }
    await fetchSuggestions(chosen.join(", "));
    toast.success("Sugestões atualizadas com base nos tópicos selecionados");
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
            Edite, remova ou selecione os temas centrais e regenere as sugestões.
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Temas centrais</h3>
                <span className="text-xs text-muted-foreground">{selected.size} selecionado(s)</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {topics.map((t, i) => {
                  const isSel = selected.has(i);
                  if (editingIdx === i) {
                    return (
                      <div key={i} className="flex items-center gap-1 bg-muted rounded-full pl-2 pr-1 py-0.5">
                        <Input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                          className="h-7 w-40 text-xs border-0 bg-transparent focus-visible:ring-0"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveEdit}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingIdx(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className={`group flex items-center gap-1 rounded-full pl-3 pr-1 py-0.5 text-xs font-medium border transition-colors cursor-pointer ${
                        isSel
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-muted/40 text-muted-foreground border-transparent"
                      }`}
                      onClick={() => toggleSelect(i)}
                    >
                      <span>{t}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(i); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded-full"
                        aria-label="Editar"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTopic(i); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded-full"
                        aria-label="Remover"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mb-3">
                <Input
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTopic()}
                  placeholder="Adicionar tópico personalizado..."
                  className="h-9 text-sm"
                />
                <Button size="sm" variant="outline" onClick={addTopic} className="gap-1">
                  <Plus className="w-4 h-4" /> Adicionar
                </Button>
              </div>
              <Button size="sm" onClick={regenerateWithSelected} className="w-full gap-2">
                <RefreshCw className="w-4 h-4" /> Regenerar com tópicos selecionados
              </Button>
            </div>

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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
