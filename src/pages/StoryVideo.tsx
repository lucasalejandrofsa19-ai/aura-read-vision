import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useStoryVideoJob, fetchStoryVideoScript, type Scene, type NarrationTone, type DraftScene } from "@/hooks/useStoryVideoJob";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Play, Pause, ChevronLeft, ChevronRight, ArrowLeft, Sparkles, Pencil, Volume2, Copy, XCircle, RotateCcw, Download, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BookVideoHistory } from "@/components/BookVideoHistory";
import { pickVideoMimeType } from "@/lib/videoMimeType";

const statusLabel: Record<string, string> = {
  idle: "Pronto",
  pending: "Na fila…",
  processing: "Gerando cenas (roteiro + imagens + narração)…",
  completed: "Pronto!",
  failed: "Falhou",
};

const stageLabel: Record<string, string> = {
  starting: "Preparando…",
  image: "Gerando imagem",
  narration: "Gerando narração",
  scene_done: "Cena pronta",
  finalizing: "Finalizando vídeo",
  completed: "Concluído",
};

type VoiceOption = { id: string; label: string; gender: "Feminina" | "Masculina"; vibe: string };
const VOICE_OPTIONS: VoiceOption[] = [
  { id: "nova",    label: "Nova",    gender: "Feminina",  vibe: "Moderna, expressiva" },
  { id: "shimmer", label: "Shimmer", gender: "Feminina",  vibe: "Suave, clara" },
  { id: "alloy",   label: "Alloy",   gender: "Feminina",  vibe: "Neutra, versátil" },
  { id: "fable",   label: "Fable",   gender: "Masculina", vibe: "Narrador clássico" },
  { id: "onyx",    label: "Onyx",    gender: "Masculina", vibe: "Grave, dramático" },
  { id: "echo",    label: "Echo",    gender: "Masculina", vibe: "Calmo, sério" },
];

const TONE_OPTIONS: { id: NarrationTone; label: string }[] = [
  { id: "neutro", label: "Neutro" },
  { id: "alegre", label: "Alegre" },
  { id: "serio", label: "Sério" },
  { id: "empolgado", label: "Empolgado" },
  { id: "dramatico", label: "Dramático" },
  { id: "calmo", label: "Calmo" },
];

const MODE_OPTIONS: { id: "summary" | "highlights" | "excerpt"; label: string; desc: string }[] = [
  { id: "summary", label: "IA (mini-histórias)", desc: "Analisa o livro inteiro e gera cenas com imagens" },
  { id: "highlights", label: "Seus destaques", desc: "Usa destaques e imagens que você já criou" },
  { id: "excerpt", label: "Trecho do livro", desc: "Cole um capítulo ou seção para virar vídeo" },
];

const SS_KEY = "aurareader:storyVideoPrefs";
type Prefs = { voice: string; tone: NarrationTone; mode: "summary" | "highlights" | "excerpt" };
const loadPrefs = (): Prefs => {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) return { voice: "nova", tone: "neutro", mode: "summary", ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { voice: "nova", tone: "neutro", mode: "summary" };
};

function useElapsedSeconds(startedAt: string | null, active: boolean) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt || !active) return;
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);

  return seconds;
}

export default function StoryVideo() {
  const { bookId = "" } = useParams();
  const { status, error, result, attempts, progress, createdAt, updatedAt, timedOut, start, cancel, reset } = useStoryVideoJob();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [started, setStarted] = useState(false);
  const [draft, setDraft] = useState<DraftScene[] | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [hasExtractedText, setHasExtractedText] = useState<boolean | null>(null);

  // Auto-switch to "Trecho do livro" when the book has no extracted_text.
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      const { data: b } = await supabase.from("books").select("extracted_text").eq("id", bookId).maybeSingle();
      let text: string | null = b?.extracted_text ?? null;
      if (!b) {
        const { data: pb } = await supabase.from("premium_books").select("extracted_text").eq("id", bookId).maybeSingle();
        text = pb?.extracted_text ?? null;
      }
      if (cancelled) return;
      const ok = !!(text && text.trim().length >= 50);
      setHasExtractedText(ok);
      if (!ok) {
        setPrefs(p => p.mode === "highlights" ? p : { ...p, mode: "excerpt" });
        toast.info("Este livro não tem texto extraído. Modo alterado para 'Trecho do livro' — cole um capítulo abaixo.");
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  const elapsedSeconds = useElapsedSeconds(createdAt, status === "pending" || status === "processing");
  const lastUpdateLabel = updatedAt
    ? (() => {
      const seconds = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000));
      return seconds < 60 ? `atualizado há ${seconds}s` : `atualizado há ${Math.floor(seconds / 60)}min`;
    })()
    : null;
  const jobProgressValue = useMemo(() => {
    if (status === "completed") return 100;
    if (status === "pending") return 8;
    if (!progress?.total) return status === "processing" ? 16 : 0;
    const sceneRatio = Math.max(0, Math.min(1, progress.current / progress.total));
    const stageBonus = progress.stage === "image" ? 0.15 : progress.stage === "narration" ? 0.55 : progress.stage === "scene_done" ? 0.85 : 0;
    return Math.min(96, Math.max(12, ((Math.max(0, progress.current - 1) + stageBonus) / progress.total) * 100));
  }, [progress, status]);

  useEffect(() => {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(prefs)); } catch { /* noop */ }
  }, [prefs]);

  // Watcher: when a chapter is pasted/typed into the excerpt field (>=50 chars),
  // auto-switch the mode to "Trecho do livro" so the generation uses that content.
  useEffect(() => {
    if (excerpt.trim().length >= 50) {
      setPrefs(p => (p.mode === "excerpt" || p.mode === "highlights") ? p : { ...p, mode: "excerpt" });
    }
  }, [excerpt]);

  const handleGenerateDraft = async () => {
    if (!bookId || loadingDraft) return;
    if (prefs.mode === "excerpt" && excerpt.trim().length < 50) {
      toast.error("Cole pelo menos ~50 caracteres do trecho para gerar o vídeo.");
      return;
    }
    setLoadingDraft(true);
    try {
      const wireMode = prefs.mode === "excerpt" ? "summary" : prefs.mode;
      const r = await fetchStoryVideoScript({
        book_id: bookId,
        mode: wireMode,
        scenesCount: 5,
        text: prefs.mode === "excerpt" ? excerpt.trim() : undefined,
      });
      if (!r.scenes?.length) throw new Error("Roteiro vazio");
      setDraft(r.scenes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar roteiro");
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleStart = (force = false) => {
    if (!bookId || (!force && started) || !draft) return;
    setStarted(true);
    const wireMode = prefs.mode === "excerpt" ? "custom" : prefs.mode;
    start({
      book_id: bookId,
      mode: wireMode,
      text: prefs.mode === "excerpt" ? excerpt.trim() : undefined,
      voice: prefs.voice,
      tone: prefs.tone,
      scenesCount: draft.length,
      scenesOverride: draft,
    });
  };


  const handleCancel = () => {
    cancel();
    setStarted(false);
    toast.info("Acompanhamento cancelado. Você pode tentar novamente.");
  };

  const handleRetry = () => {
    reset();
    handleStart(true);
  };

  const updateDraftScene = (i: number, patch: Partial<DraftScene>) => {
    setDraft(d => d ? d.map((s, idx) => idx === i ? { ...s, ...patch } : s) : d);
  };


  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/library"><ArrowLeft className="mr-2 h-4 w-4" /> Biblioteca</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {statusLabel[status] ?? status}{attempts > 0 ? ` · tentativa ${attempts}` : ""}
          </span>
        </div>

        <h1 className="mb-6 text-3xl font-bold">Vídeo narrado por IA</h1>

        {error && (
          <Card className="mb-4 space-y-3 border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert" aria-live="assertive">
            <div className="flex items-start gap-2 text-destructive">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{timedOut ? "Tempo limite excedido" : error?.startsWith("Vídeo concluído sem dados") ? "Vídeo concluído, mas sem dados de cenas" : "Falha na geração do vídeo"}</p>
                <p className="mt-1 break-words text-muted-foreground">{error}</p>
              </div>
            </div>
            {started && !result && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="sm" variant="default" onClick={handleRetry} disabled={!draft}>
                  <RotateCcw className="mr-2 h-3 w-3" /> Tentar novamente
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              </div>
            )}
          </Card>
        )}

        {!started && !result && !draft && (
          <Card className="space-y-5 p-6">
            <div>
              <h2 className="text-lg font-semibold">Configurar narração</h2>
              <p className="text-sm text-muted-foreground">Escolha modo, voz e tom. Você poderá revisar e editar as narrações antes de gerar o vídeo.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Modo</Label>
                <Select value={prefs.mode} onValueChange={(v) => setPrefs(p => ({ ...p, mode: v as Prefs["mode"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODE_OPTIONS.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        <div className="flex flex-col">
                          <span>{o.label}</span>
                          <span className="text-xs text-muted-foreground">{o.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Voz</Label>
                <Select value={prefs.voice} onValueChange={(v) => setPrefs(p => ({ ...p, voice: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        <div className="flex flex-col">
                          <span>{v.label} · {v.gender}</span>
                          <span className="text-xs text-muted-foreground">{v.vibe}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tom da narração</Label>
                <Select value={prefs.tone} onValueChange={(v) => setPrefs(p => ({ ...p, tone: v as NarrationTone }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(prefs.mode === "excerpt" || prefs.mode === "summary") && (
              <div className="space-y-2">
                <Label htmlFor="excerpt-text">
                  Trecho do livro {prefs.mode === "summary" && <span className="text-[11px] text-muted-foreground">(opcional — colando aqui, o modo muda para "Trecho do livro")</span>}
                </Label>
                <Textarea
                  id="excerpt-text"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value.slice(0, 50000))}
                  onPaste={() => {
                    // Defer to next tick so excerpt state already reflects pasted content
                    setTimeout(() => setPrefs(p => p.mode === "highlights" ? p : { ...p, mode: "excerpt" }), 0);
                  }}
                  placeholder="Cole aqui o capítulo ou seção do livro que deseja transformar em vídeo (mín. ~50 caracteres)…"
                  className="min-h-[140px]"
                />
                <p className="text-[11px] text-muted-foreground">{excerpt.trim().length} caracteres · até 50.000</p>
              </div>
            )}

            <Button onClick={handleGenerateDraft} disabled={!bookId || loadingDraft} className="w-full md:w-auto">
              {loadingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              {loadingDraft ? "Gerando roteiro…" : "Gerar roteiro para edição"}
            </Button>
          </Card>
        )}

        {!started && !result && draft && (
          <Card className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Revisar narrações</h2>
                <p className="text-sm text-muted-foreground">Edite o texto de cada cena antes de gerar o vídeo final.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Voltar</Button>
            </div>

            <div className="space-y-4">
              {draft.map((s, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border bg-card/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Cena {i + 1}</span>
                    <span className="text-xs text-muted-foreground">{s.narration.trim().split(/\s+/).filter(Boolean).length} palavras</span>
                  </div>
                  <Input
                    value={s.chapterTitle}
                    onChange={(e) => updateDraftScene(i, { chapterTitle: e.target.value })}
                    placeholder="Título da cena"
                    maxLength={200}
                  />
                  <Textarea
                    value={s.narration}
                    onChange={(e) => updateDraftScene(i, { narration: e.target.value })}
                    placeholder="Texto que será narrado nesta cena"
                    rows={3}
                    maxLength={1200}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => handleStart()} disabled={!bookId || draft.some(s => !s.narration.trim())} className="flex-1">
                <Sparkles className="mr-2 h-4 w-4" /> Gerar vídeo com minhas narrações
              </Button>
              <Button variant="outline" onClick={handleGenerateDraft} disabled={loadingDraft}>
                {loadingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refazer roteiro
              </Button>
            </div>
          </Card>
        )}


        {started && !result && !error && (
          <Card className="flex flex-col items-center gap-5 p-10 text-center" role="status" aria-live="polite">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="font-medium">{statusLabel[status] ?? status}</p>
              <p className="text-sm text-muted-foreground">
                {status === "pending"
                  ? "Seu vídeo entrou na fila. A geração inicia em instantes."
                  : "Montando seu vídeo parte por parte."}
              </p>
            </div>

            <div className="w-full max-w-md space-y-2 text-left">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(jobProgressValue)}%</span>
                <span>{Math.floor(elapsedSeconds / 60)}min {elapsedSeconds % 60}s</span>
              </div>
              <Progress value={jobProgressValue} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Status: {status}</span>
                {lastUpdateLabel && <span>{lastUpdateLabel}</span>}
              </div>
            </div>

            {progress && progress.total > 0 && (
              <div className="w-full max-w-md space-y-3 text-left">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    Cena {Math.min(progress.current, progress.total)} de {progress.total}
                  </span>
                  <span className="text-muted-foreground">
                    {progress.etaSeconds > 0 ? `~${progress.etaSeconds}s restantes` : "finalizando…"}
                  </span>
                </div>
                <Progress value={(progress.current / progress.total) * 100} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{stageLabel[progress.stage] ?? progress.stage}</span>
                  {progress.sceneTitle && <span className="truncate pl-2">{progress.sceneTitle}</span>}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
            </div>
          </Card>
        )}

        {result && <ScenePlayer scenes={result.scenes} title={result.title} draft={draft} mode={prefs.mode === "excerpt" ? "summary" : prefs.mode} voice={prefs.voice} tone={prefs.tone} />}

        {bookId && (
          <div className="mt-6">
            <BookVideoHistory bookId={bookId} refreshKey={status === "completed" ? 1 : 0} />
          </div>
        )}
      </div>
    </main>
  );
}

type ScenePlayerProps = {
  scenes: Scene[];
  title: string;
  draft: DraftScene[] | null;
  mode: "summary" | "highlights";
  voice: string;
  tone: NarrationTone;
};

function ScenePlayer({ scenes: initialScenes, title, draft, mode, voice, tone }: ScenePlayerProps) {
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [regenerating, setRegenerating] = useState<false | "audio" | "full">(false);
  const [regenProgress, setRegenProgress] = useState(0);
  const [regenLabel, setRegenLabel] = useState("");
  const [regenError, setRegenError] = useState<{ kind: "audio" | "full"; message: string; code?: string | number; timestamp: string; sceneIndex: number; sceneTitle: string; voice: string; tone: string; mode: string } | null>(null);

  useEffect(() => {
    if (!regenerating) { setRegenProgress(0); return; }
    setRegenProgress(8);
    setRegenLabel(regenerating === "audio" ? "Gerando narração…" : "Gerando narração e imagem…");
    const t = window.setInterval(() => {
      setRegenProgress(p => {
        const cap = regenerating === "audio" ? 92 : 90;
        if (p >= cap) return p;
        const step = regenerating === "audio" ? 4 : 2;
        return Math.min(cap, p + step);
      });
    }, regenerating === "audio" ? 350 : 600);
    return () => window.clearInterval(t);
  }, [regenerating]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scene = scenes[idx];
  const segImages = useMemo(() => scene?.segments.map(s => s.imageDataUrl).filter(Boolean) ?? [], [scene]);
  const [segIdx, setSegIdx] = useState(0);

  useEffect(() => { setScenes(initialScenes); }, [initialScenes]);
  useEffect(() => { setSegIdx(0); setEditedText(scene?.narration ?? ""); }, [idx, scene?.narration]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => {
      if (idx < scenes.length - 1) setIdx(i => i + 1);
      else setPlaying(false);
    };
    a.addEventListener("ended", onEnd);
    return () => a.removeEventListener("ended", onEnd);
  }, [idx, scenes.length]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing, idx]);

  useEffect(() => {
    if (!playing || segImages.length <= 1) return;
    const a = audioRef.current;
    const dur = a?.duration && isFinite(a.duration) ? a.duration : 10;
    const per = (dur / segImages.length) * 1000;
    const t = window.setInterval(() => setSegIdx(i => (i + 1) % segImages.length), per);
    return () => window.clearInterval(t);
  }, [playing, segImages.length, idx]);

  const runRegen = async (audioOnly: boolean) => {
    if (!scene || regenerating) return;
    const narration = editedText.trim();
    if (narration.length < 2) {
      toast.error("Digite um texto para narrar.");
      return;
    }
    setRegenerating(audioOnly ? "audio" : "full");
    setRegenError(null);
    setPlaying(false);
    try {
      const draftScene = draft?.[idx];
      const { data, error } = await supabase.functions.invoke("regenerate-story-video-scene", {
        body: {
          mode, voice, tone, narration, audioOnly,
          chapterTitle: scene.chapterTitle,
          imagePrompt: draftScene?.imagePrompt,
          highlightId: draftScene?.highlightId,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const next = data as Scene & { audioOnly?: boolean };
      if (audioOnly && !next.audioDataUrl) throw new Error("Áudio vazio retornado pelo servidor.");
      setScenes(curr => curr.map((s, i) => {
        if (i !== idx) return s;
        if (audioOnly) return { ...s, narration: next.narration, audioDataUrl: next.audioDataUrl };
        return { ...s, ...next };
      }));
      toast.success(audioOnly ? "Áudio regenerado." : "Cena regenerada.");
    } catch (e) {
      const err = e as { message?: string; status?: number; code?: string | number; name?: string } | Error;
      const msg = (err as Error)?.message || "Falha ao regenerar";
      const code = (err as { status?: number; code?: string | number })?.status ?? (err as { code?: string | number })?.code;
      setRegenError({
        kind: audioOnly ? "audio" : "full",
        message: msg,
        code,
        timestamp: new Date().toISOString(),
        sceneIndex: idx + 1,
        sceneTitle: scene.chapterTitle,
        voice, tone, mode,
      });
      toast.error(msg);
    } finally {
      setRegenerating(false);
    }
  };
  const handleRegenScene = () => runRegen(false);
  const handleRegenAudio = () => runRegen(true);

  if (!scene) return null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {segImages.length > 0 ? (
            segImages.map((src, i) => (
              <img
                key={`${idx}-${i}-${src.slice(0, 32)}`}
                src={src}
                alt={scene.chapterTitle}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out"
                style={{ opacity: i === segIdx ? 1 : 0 }}
              />
            ))
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">Sem imagem</div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
            <p className="text-xs uppercase tracking-wide opacity-80">{title}</p>
            <h2 className="text-lg font-semibold">{scene.chapterTitle}</h2>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <audio ref={audioRef} src={scene.audioDataUrl} preload="auto" />

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button onClick={() => setPlaying(p => !p)} className="flex-1" disabled={!!regenerating}>
              {playing ? <><Pause className="mr-2 h-4 w-4" /> Pausar</> : <><Play className="mr-2 h-4 w-4" /> Reproduzir</>}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setIdx(i => Math.min(scenes.length - 1, i + 1))} disabled={idx === scenes.length - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">Cena {idx + 1} / {scenes.length}</p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => {
                try {
                  const safeTitle = title.replace(/[^\w\- ]+/g, "").slice(0, 60) || "video";
                  const payload = scenes.map(s => ({
                    title: s.chapterTitle,
                    narration: s.narration,
                    audio: s.audioDataUrl ?? "",
                    images: (s.segments ?? []).map(g => g.imageDataUrl).filter(Boolean),
                  }));
                  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${safeTitle}</title><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh}main{width:100%;max-width:960px;padding:16px}img{width:100%;border-radius:12px;aspect-ratio:16/9;object-fit:cover;background:#111}h2{font-size:18px;margin:12px 0 6px}p{opacity:.85;line-height:1.5}button{background:#fff;color:#000;border:0;padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer;margin:8px 6px}nav{display:flex;justify-content:center;gap:8px;margin-top:8px}</style></head><body><main><img id="img" alt=""/><h2 id="t"></h2><p id="n"></p><nav><button id="prev">‹ Anterior</button><button id="play">▶ Reproduzir</button><button id="next">Próxima ›</button></nav><audio id="a" preload="auto"></audio></main><script>const D=${JSON.stringify(payload)};let i=0;const a=document.getElementById('a'),img=document.getElementById('img'),t=document.getElementById('t'),n=document.getElementById('n'),pl=document.getElementById('play');function load(){const s=D[i];t.textContent=s.title;n.textContent=s.narration;img.src=s.images[0]||'';a.src=s.audio||''}function play(){a.play().then(()=>pl.textContent='⏸ Pausar').catch(()=>{})}function pause(){a.pause();pl.textContent='▶ Reproduzir'}pl.onclick=()=>a.paused?play():pause();document.getElementById('prev').onclick=()=>{if(i>0){i--;load();play()}};document.getElementById('next').onclick=()=>{if(i<D.length-1){i++;load();play()}};a.onended=()=>{if(i<D.length-1){i++;load();play()}else pause()};load();<\/script></body></html>`;
                  const blob = new Blob([html], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${safeTitle}.html`;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 2000);
                  toast.success("Player HTML baixado. Abra para reproduzir o vídeo completo.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha ao exportar.");
                }
              }}
              disabled={!!regenerating}
            >
              <Download className="mr-2 h-4 w-4" /> Exportar (HTML)
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const audio = scene.audioDataUrl;
                if (!audio) { toast.error("Áudio indisponível para esta cena."); return; }
                const link = document.createElement("a");
                link.href = audio;
                link.download = `cena-${idx + 1}.mp3`;
                document.body.appendChild(link);
                link.click();
                link.remove();
              }}
              disabled={!scene.audioDataUrl}
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Baixar áudio da cena
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  const safeTitle = title.replace(/[^\w\- ]+/g, "").slice(0, 60) || "video";
                  let cursor = 0;
                  const scenesMeta = scenes.map((s, i) => {
                    const words = (s.narration || "").split(/\s+/).filter(Boolean);
                    const duration = Math.max(2, Math.round((words.length / 150) * 60));
                    const start = cursor; cursor += duration;
                    return {
                      index: i,
                      title: s.chapterTitle,
                      narration: s.narration,
                      wordCount: words.length,
                      startSec: start,
                      endSec: cursor,
                      durationSec: duration,
                      imageCount: (s.segments ?? []).filter(g => g.imageDataUrl).length,
                      hasAudio: !!s.audioDataUrl,
                    };
                  });
                  const payload = {
                    version: 1, kind: "story-video-script",
                    title, mode, voice, tone,
                    generatedAt: new Date().toISOString(),
                    totalDurationSec: cursor,
                    scenes: scenesMeta,
                  };
                  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url; link.download = `${safeTitle}-roteiro.json`;
                  document.body.appendChild(link); link.click(); link.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 2000);
                  toast.success("Roteiro JSON exportado.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha ao exportar JSON.");
                }
              }}
              disabled={!!regenerating}
            >
              <Download className="mr-2 h-4 w-4" /> Exportar roteiro (JSON)
            </Button>
            <Button
              variant="default"
              className="sm:col-span-2"
              onClick={async () => {
                const safeTitle = title.replace(/[^\w\- ]+/g, "").slice(0, 60) || "video";
                const choice = pickVideoMimeType();
                if (!choice) { toast.error("Seu navegador não suporta gravação de vídeo."); return; }
                const { mimeType, ext } = choice;
                const tId = toast.loading("Renderizando vídeo… isso pode levar alguns segundos.");
                try {
                  const W = 1280, H = 720;
                  const canvas = document.createElement("canvas");
                  canvas.width = W; canvas.height = H;
                  const ctx = canvas.getContext("2d")!;
                  const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
                  const audioCtx = new AC();
                  const dest = audioCtx.createMediaStreamDestination();
                  const videoStream = canvas.captureStream(30);
                  const stream = new MediaStream([
                    ...videoStream.getVideoTracks(),
                    ...dest.stream.getAudioTracks(),
                  ]);
                  const chunks: Blob[] = [];
                  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
                  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
                  const done = new Promise<void>((res) => { rec.onstop = () => res(); });
                  rec.start(250);

                  const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
                    const img = new Image(); img.crossOrigin = "anonymous";
                    img.onload = () => res(img); img.onerror = rej; img.src = src;
                  });
                  const drawCover = (img: HTMLImageElement) => {
                    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
                    const r = Math.max(W / img.width, H / img.height);
                    const w = img.width * r, h = img.height * r;
                    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
                    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, H - 100, W, 100);
                    ctx.fillStyle = "#fff"; ctx.font = "bold 28px system-ui, sans-serif";
                    ctx.fillText(scenes[0]?.chapterTitle?.slice(0, 60) ?? title, 32, H - 40);
                  };

                  for (let i = 0; i < scenes.length; i++) {
                    const s = scenes[i];
                    const imgs = (s.segments ?? []).map(g => g.imageDataUrl).filter(Boolean) as string[];
                    const loaded = await Promise.all(imgs.map(src => loadImg(src).catch(() => null)));
                    const valid = loaded.filter(Boolean) as HTMLImageElement[];
                    if (!s.audioDataUrl) {
                      if (valid[0]) drawCover(valid[0]);
                      await new Promise(r => setTimeout(r, 1500));
                      continue;
                    }
                    const audioRes = await fetch(s.audioDataUrl);
                    const arrayBuf = await audioRes.arrayBuffer();
                    const audioBuf = await audioCtx.decodeAudioData(arrayBuf.slice(0));
                    const src = audioCtx.createBufferSource();
                    src.buffer = audioBuf;
                    src.connect(dest);
                    const dur = audioBuf.duration;
                    const startT = performance.now();
                    src.start();
                    const perImg = valid.length > 0 ? (dur * 1000) / valid.length : dur * 1000;
                    await new Promise<void>((resolve) => {
                      const tick = () => {
                        const elapsed = performance.now() - startT;
                        const idx = valid.length > 0 ? Math.min(valid.length - 1, Math.floor(elapsed / perImg)) : -1;
                        if (idx >= 0 && valid[idx]) drawCover(valid[idx]);
                        if (elapsed >= dur * 1000) { resolve(); return; }
                        requestAnimationFrame(tick);
                      };
                      tick();
                    });
                  }
                  rec.stop();
                  await done;
                  try { audioCtx.close(); } catch { /* noop */ }
                  const blob = new Blob(chunks, { type: mimeType });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url; link.download = `${safeTitle}.${ext}`;
                  document.body.appendChild(link); link.click(); link.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 2000);
                  toast.success(`Vídeo .${ext} pronto!`, { id: tId });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha ao renderizar vídeo.", { id: tId });
                }
              }}
              disabled={!!regenerating}
            >
              <Download className="mr-2 h-4 w-4" /> Baixar vídeo (MP4)
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-card/50 p-3">
            <Label className="text-xs">Texto narrado desta cena</Label>
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={3}
              maxLength={1200}
              disabled={!!regenerating}
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                onClick={handleRegenAudio}
                disabled={!!regenerating || editedText.trim() === scene.narration.trim()}
                variant="default"
                className="w-full"
                title="Mais rápido: regenera só a narração mantendo a imagem"
              >
                {regenerating === "audio"
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {regenProgress}%</>
                  : <><Volume2 className="mr-2 h-4 w-4" /> Regenerar Áudio</>}
              </Button>
              <Button
                onClick={handleRegenScene}
                disabled={!!regenerating || editedText.trim() === scene.narration.trim()}
                variant="secondary"
                className="w-full"
              >
                {regenerating === "full"
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {regenProgress}%</>
                  : <><Sparkles className="mr-2 h-4 w-4" /> Áudio + Imagem</>}
              </Button>
            </div>
            {regenError && !regenerating && (() => {
              const report = [
                `[StoryVideo] ${regenError.kind === "audio" ? "Audio-only regeneration failure" : "Scene regeneration failure"}`,
                `Timestamp: ${regenError.timestamp}`,
                `Scene: #${regenError.sceneIndex} — ${regenError.sceneTitle}`,
                `Mode: ${regenError.mode} | Voice: ${regenError.voice} | Tone: ${regenError.tone}`,
                regenError.code !== undefined ? `Code: ${regenError.code}` : null,
                `Message: ${regenError.message}`,
                `URL: ${typeof window !== "undefined" ? window.location.href : ""}`,
                `UA: ${typeof navigator !== "undefined" ? navigator.userAgent : ""}`,
              ].filter(Boolean).join("\n");
              const copy = async () => {
                try {
                  await navigator.clipboard.writeText(report);
                  toast.success("Erro copiado!");
                } catch {
                  toast.error("Não foi possível copiar. Selecione manualmente.");
                }
              };
              return (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert" aria-live="assertive">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-destructive">
                      {regenError.kind === "audio" ? "Falha ao regenerar o áudio" : "Falha ao regenerar a cena"}
                      {regenError.code !== undefined && <span className="ml-1 text-xs opacity-70">(código {regenError.code})</span>}
                    </p>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copy} title="Copiar detalhes do erro">
                      <Copy className="mr-1 h-3 w-3" /> Copiar
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground break-words">{regenError.message}</p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 text-[10px] text-muted-foreground border border-border">{report}</pre>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="default" onClick={() => runRegen(regenError.kind === "audio")}>
                      <Sparkles className="mr-2 h-3 w-3" /> Tentar novamente
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRegenError(null)}>Dispensar</Button>
                  </div>
                </div>
              );
            })()}
            {regenerating && (
              <div className="space-y-1 pt-1" role="status" aria-live="polite">
                <Progress value={regenProgress} className="h-2" />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> {regenLabel} ({regenProgress}%)
                </p>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              "Regenerar Áudio" é mais rápido pois reutiliza a imagem atual.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
