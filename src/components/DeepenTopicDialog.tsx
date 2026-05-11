import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, BookOpen, Video, FileText, Sparkles, ExternalLink, HelpCircle, Pencil, Check, X, Plus, RefreshCw, Download, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pdf, Document, Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";
import { saveAs } from "file-saver";

interface ExportRow {
  id: string;
  book_title: string | null;
  topics: string[] | null;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

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
  const [history, setHistory] = useState<ExportRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = async () => {
    const { data: rows, error } = await supabase
      .from("deepen_exports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && rows) setHistory(rows as ExportRow[]);
  };

  useEffect(() => {
    if (open) loadHistory();
  }, [open]);

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

  const exportPDF = async () => {
    if (!data) return;
    try {
      const styles = StyleSheet.create({
        page: { padding: 36, fontSize: 11, fontFamily: "Helvetica", color: "#1a1a1a" },
        h1: { fontSize: 20, marginBottom: 4, fontFamily: "Helvetica-Bold" },
        sub: { fontSize: 10, color: "#666", marginBottom: 16 },
        h2: { fontSize: 13, marginTop: 14, marginBottom: 6, fontFamily: "Helvetica-Bold", color: "#0f3460" },
        item: { marginBottom: 8 },
        title: { fontFamily: "Helvetica-Bold" },
        desc: { color: "#444", marginTop: 2 },
        link: { color: "#2563eb", fontSize: 10, marginTop: 2 },
        chip: { fontSize: 10, color: "#0f3460" },
        q: { marginBottom: 6, paddingLeft: 8, borderLeft: "2px solid #c9a84c" },
      });
      const chosen = topics.filter((_, i) => selected.has(i));
      const Doc = (
        <Document>
          <Page size="A4" style={styles.page} wrap>
            <Text style={styles.h1}>Aprofundar Tópico</Text>
            <Text style={styles.sub}>
              {bookTitle ? `${bookTitle} • ` : ""}Gerado em {new Date().toLocaleDateString("pt-BR")}
            </Text>

            {chosen.length > 0 && (
              <View>
                <Text style={styles.h2}>Temas centrais</Text>
                <Text style={styles.chip}>{chosen.join(" • ")}</Text>
              </View>
            )}

            {data.articles && data.articles.length > 0 && (
              <View>
                <Text style={styles.h2}>Artigos e estudos</Text>
                {data.articles.map((a, i) => (
                  <View key={i} style={styles.item} wrap={false}>
                    <Text style={styles.title}>{a.title}</Text>
                    <Text style={styles.desc}>{a.description}</Text>
                    <Link src={googleScholar(a.searchQuery || a.title)} style={styles.link}>
                      Buscar no Google Scholar
                    </Link>
                  </View>
                ))}
              </View>
            )}

            {data.videos && data.videos.length > 0 && (
              <View>
                <Text style={styles.h2}>Vídeos recomendados</Text>
                {data.videos.map((v, i) => (
                  <View key={i} style={styles.item} wrap={false}>
                    <Text style={styles.title}>{v.title}</Text>
                    <Text style={styles.desc}>{v.description}</Text>
                    <Link src={youtube(v.searchQuery || v.title)} style={styles.link}>
                      Buscar no YouTube
                    </Link>
                  </View>
                ))}
              </View>
            )}

            {data.books && data.books.length > 0 && (
              <View>
                <Text style={styles.h2}>Livros relacionados</Text>
                {data.books.map((b, i) => (
                  <View key={i} style={styles.item} wrap={false}>
                    <Text style={styles.title}>{b.title} — {b.author}</Text>
                    <Text style={styles.desc}>{b.description}</Text>
                    <Link src={googleBooks(`${b.title} ${b.author}`)} style={styles.link}>
                      Ver no Google Livros
                    </Link>
                  </View>
                ))}
              </View>
            )}

            {data.questions && data.questions.length > 0 && (
              <View>
                <Text style={styles.h2}>Perguntas para reflexão</Text>
                {data.questions.map((q, i) => (
                  <Text key={i} style={styles.q}>{q}</Text>
                ))}
              </View>
            )}
          </Page>
        </Document>
      );
      const blob = await pdf(Doc).toBlob();
      const name = `aprofundar-${(bookTitle || "topico").replace(/[^\w\-]+/g, "_")}-${Date.now()}.pdf`;
      saveAs(blob, name);

      // Save to user history
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (uid) {
          const path = `${uid}/${name}`;
          const { error: upErr } = await supabase.storage
            .from("deepen-exports")
            .upload(path, blob, { contentType: "application/pdf", upsert: false });
          if (upErr) throw upErr;
          await supabase.from("deepen_exports").insert({
            user_id: uid,
            book_title: bookTitle ?? null,
            topics: chosen,
            file_path: path,
            file_size: blob.size,
          });
          await loadHistory();
        }
      } catch (histErr) {
        console.warn("history save failed", histErr);
      }

      toast.success("PDF exportado e salvo no histórico!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar PDF");
    }
  };

  const downloadFromHistory = async (row: ExportRow) => {
    const { data: signed, error } = await supabase.storage
      .from("deepen-exports")
      .createSignedUrl(row.file_path, 60);
    if (error || !signed?.signedUrl) {
      toast.error("Não foi possível baixar este arquivo");
      return;
    }
    const res = await fetch(signed.signedUrl);
    const blob = await res.blob();
    saveAs(blob, row.file_path.split("/").pop() || "aprofundar.pdf");
  };

  const deleteFromHistory = async (row: ExportRow) => {
    await supabase.storage.from("deepen-exports").remove([row.file_path]);
    await supabase.from("deepen_exports").delete().eq("id", row.id);
    setHistory((h) => h.filter((r) => r.id !== row.id));
    toast.success("Removido do histórico");
  };

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
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={exportPDF} className="gap-2">
                <Download className="w-4 h-4" /> Exportar PDF
              </Button>
            </div>
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
