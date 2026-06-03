import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clapperboard, Download, Loader2, Play, Sparkles, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useBooks } from "@/hooks/useBooks";
import { useUserData } from "@/hooks/useUserData";
import { supabase } from "@/integrations/supabase/client";
import { recordStoryVideo, type StoryScene } from "@/lib/storyVideoRecorder";

type Mode = "summary" | "pages";

interface SceneResult extends StoryScene { imagePrompt: string }

const VOICES = [
  { id: "nova", label: "Nova (feminina, brasileira)" },
  { id: "alloy", label: "Alloy (neutra)" },
  { id: "shimmer", label: "Shimmer (suave)" },
  { id: "onyx", label: "Onyx (masculina, grave)" },
  { id: "echo", label: "Echo (masculina, clara)" },
  { id: "fable", label: "Fable (narrativa)" },
];

const StoryVideos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { books, premiumBooks } = useBooks();
  const { hasPremiumAccess } = useUserData();

  const allBooks = useMemo(() => {
    const own = (books || []).map(b => ({ id: b.id, title: b.title, total_pages: b.total_pages, source: "user" as const }));
    const prem = (premiumBooks || []).map((b: any) => ({ id: b.id, title: b.title, total_pages: b.total_pages, source: "premium" as const }));
    return [...own, ...prem];
  }, [books, premiumBooks]);

  const [bookId, setBookId] = useState<string>("");
  const [mode, setMode] = useState<Mode>("summary");
  const [scenesCount, setScenesCount] = useState(5);
  const [voice, setVoice] = useState("nova");
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(10);

  const [generating, setGenerating] = useState(false);
  const [scenes, setScenes] = useState<SceneResult[]>([]);
  const [bookTitle, setBookTitle] = useState("");
  const [quota, setQuota] = useState<{ used: number; limit: number; premium: boolean } | null>(null);

  const [recording, setRecording] = useState(false);
  const [recProgress, setRecProgress] = useState(0);
  const [recLabel, setRecLabel] = useState("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const previewRef = useRef<HTMLVideoElement>(null);

  const selectedBook = allBooks.find(b => b.id === bookId);

  // Initial quota fetch
  useEffect(() => {
    if (!user) return;
    (supabase.rpc as any)("can_generate_story_video", { _user_id: user.id }).then(({ data }: any) => {
      if (data) setQuota(data as any);
    });
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Faça login</h1>
          <p className="text-muted-foreground">Você precisa estar logado para gerar vídeos narrados.</p>
          <Button onClick={() => navigate("/library")}>Ir para biblioteca</Button>
        </Card>
      </div>
    );
  }

  async function getBookExtractedText(): Promise<string | null> {
    if (!selectedBook) return null;
    const table = selectedBook.source === "user" ? "books" : "premium_books";
    const { data } = await supabase.from(table).select("extracted_text").eq("id", selectedBook.id).maybeSingle();
    return (data as any)?.extracted_text ?? null;
  }

  async function handleGenerate() {
    if (!bookId) { toast.error("Selecione um livro"); return; }
    setGenerating(true);
    setScenes([]);
    setVideoUrl("");
    try {
      // For pages mode, slice by page-range estimate
      let textPayload: string | undefined;
      if (mode === "pages") {
        if (endPage < startPage) { toast.error("Intervalo inválido"); setGenerating(false); return; }
        const full = await getBookExtractedText();
        if (full && selectedBook?.total_pages) {
          const tp = selectedBook.total_pages;
          const len = full.length;
          const a = Math.max(0, Math.floor(((startPage - 1) / tp) * len));
          const b = Math.min(len, Math.ceil((endPage / tp) * len));
          textPayload = full.slice(a, b);
        } else if (full) {
          textPayload = full.slice(0, 12000);
        } else {
          toast.error("Texto do livro não disponível. Abra o livro no leitor primeiro.");
          setGenerating(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("generate-story-video", {
        body: {
          book_id: bookId,
          mode,
          scenesCount,
          voice,
          ...(textPayload ? { text: textPayload } : {}),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const res = data as { title: string; scenes: SceneResult[]; quota: any };
      setScenes(res.scenes || []);
      setBookTitle(res.title || selectedBook?.title || "");
      if (res.quota) setQuota(res.quota);
      toast.success(`${res.scenes.length} cenas geradas!`);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Erro ao gerar vídeo";
      toast.error(msg);
      if (e?.context?.body) {
        try {
          const parsed = JSON.parse(e.context.body);
          if (parsed?.quota) setQuota(parsed.quota);
        } catch {}
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleRecord() {
    if (!scenes.length) return;
    setRecording(true);
    setRecProgress(0);
    setVideoUrl("");
    try {
      const blob = await recordStoryVideo(scenes, {
        onProgress: (p, label) => { setRecProgress(Math.round(p * 100)); if (label) setRecLabel(label); },
        title: bookTitle,
      });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      toast.success("Vídeo pronto! Clique em baixar.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gravar vídeo: " + (e?.message || ""));
    } finally {
      setRecording(false);
    }
  }

  function handleDownload() {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `${(bookTitle || "historia").replace(/[^\w\-]+/g, "_")}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Histórias em Vídeo IA | AURA READ" description="Transforme seus livros em vídeos narrados com imagens geradas por IA." />

      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/library")} aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Clapperboard className="w-6 h-6 text-primary" />
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-tight">Histórias em Vídeo IA</h1>
            <p className="text-xs text-muted-foreground">Slideshow narrado gerado por IA, baixe como vídeo.</p>
          </div>
          {quota && (
            <Badge variant={quota.premium ? "default" : "secondary"} className="gap-1">
              {quota.premium && <Crown className="w-3 h-3" />}
              {quota.premium ? "Ilimitado" : `${quota.used}/${quota.limit} este mês`}
            </Badge>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>Livro</Label>
            <Select value={bookId} onValueChange={setBookId}>
              <SelectTrigger><SelectValue placeholder="Selecione um livro da sua biblioteca" /></SelectTrigger>
              <SelectContent>
                {allBooks.length === 0 && <div className="p-2 text-sm text-muted-foreground">Nenhum livro disponível</div>}
                {allBooks.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.title}{b.source === "premium" ? " · Premium" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid grid-cols-2 w-full max-w-sm">
              <TabsTrigger value="summary">Resumo IA</TabsTrigger>
              <TabsTrigger value="pages">Trecho</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="text-sm text-muted-foreground pt-3">
              A IA cria um roteiro a partir do livro inteiro e narra a essência da história.
            </TabsContent>
            <TabsContent value="pages" className="pt-3">
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <div className="space-y-1">
                  <Label className="text-xs">Página inicial</Label>
                  <Input type="number" min={1} value={startPage} onChange={e => setStartPage(Number(e.target.value) || 1)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Página final</Label>
                  <Input type="number" min={1} value={endPage} onChange={e => setEndPage(Number(e.target.value) || 1)} />
                </div>
              </div>
              {selectedBook?.total_pages && (
                <p className="text-xs text-muted-foreground mt-2">Livro com {selectedBook.total_pages} páginas.</p>
              )}
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Voz da narração</Label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Número de cenas</Label>
              <Select value={String(scenesCount)} onValueChange={(v) => setScenesCount(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6].map(n => <SelectItem key={n} value={String(n)}>{n} cenas</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={generating || !bookId} className="w-full sm:w-auto" size="lg">
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando roteiro, imagens e narração…</> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar vídeo</>}
          </Button>
          {!hasPremiumAccess && quota && !quota.premium && (
            <p className="text-xs text-muted-foreground">
              Plano gratuito: {quota.limit} vídeo por mês. <button className="underline" onClick={() => navigate("/pricing")}>Upgrade para ilimitado</button>.
            </p>
          )}
        </Card>

        {scenes.length > 0 && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-lg">Pré-visualização das cenas</h2>
              <div className="flex gap-2">
                <Button onClick={handleRecord} disabled={recording} variant="default">
                  {recording ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gravando…</> : <><Play className="w-4 h-4 mr-2" /> Gerar vídeo MP4</>}
                </Button>
                {videoUrl && (
                  <Button onClick={handleDownload} variant="secondary"><Download className="w-4 h-4 mr-2" /> Baixar vídeo</Button>
                )}
              </div>
            </div>

            {recording && (
              <div className="space-y-1">
                <Progress value={recProgress} />
                <p className="text-xs text-muted-foreground">{recLabel} ({recProgress}%)</p>
              </div>
            )}

            {videoUrl && (
              <video ref={previewRef} src={videoUrl} controls className="w-full rounded-md bg-black" />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenes.map((s, i) => (
                <div key={i} className="space-y-2 border rounded-md overflow-hidden bg-card">
                  {s.imageDataUrl ? (
                    <img src={s.imageDataUrl} alt={`Cena ${i + 1}`} className="w-full aspect-video object-cover" />
                  ) : (
                    <div className="w-full aspect-video bg-muted flex items-center justify-center text-xs text-muted-foreground">Sem imagem</div>
                  )}
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Cena {i + 1}</p>
                    <p className="text-sm leading-snug">{s.narration}</p>
                    {s.audioDataUrl && <audio src={s.audioDataUrl} controls className="w-full h-8" />}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default StoryVideos;
