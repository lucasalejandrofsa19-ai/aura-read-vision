import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useStoryVideoJob, fetchStoryVideoScript, type Scene, type NarrationTone, type DraftScene } from "@/hooks/useStoryVideoJob";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Play, Pause, ChevronLeft, ChevronRight, ArrowLeft, Sparkles, Pencil, Volume2, Copy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

const MODE_OPTIONS: { id: "summary" | "highlights"; label: string; desc: string }[] = [
  { id: "summary", label: "IA (mini-histórias)", desc: "Analisa o livro e gera cenas com imagens" },
  { id: "highlights", label: "Seus destaques", desc: "Usa destaques e imagens que você já criou" },
];

const SS_KEY = "aurareader:storyVideoPrefs";
type Prefs = { voice: string; tone: NarrationTone; mode: "summary" | "highlights" };
const loadPrefs = (): Prefs => {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) return { voice: "nova", tone: "neutro", mode: "summary", ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { voice: "nova", tone: "neutro", mode: "summary" };
};

export default function StoryVideo() {
  const { bookId = "" } = useParams();
  const { status, error, result, attempts, progress, start } = useStoryVideoJob();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [started, setStarted] = useState(false);
  const [draft, setDraft] = useState<DraftScene[] | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);

  useEffect(() => {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(prefs)); } catch { /* noop */ }
  }, [prefs]);

  const handleGenerateDraft = async () => {
    if (!bookId || loadingDraft) return;
    setLoadingDraft(true);
    try {
      const r = await fetchStoryVideoScript({ book_id: bookId, mode: prefs.mode, scenesCount: 5 });
      if (!r.scenes?.length) throw new Error("Roteiro vazio");
      setDraft(r.scenes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar roteiro");
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleStart = () => {
    if (!bookId || started || !draft) return;
    setStarted(true);
    start({
      book_id: bookId,
      mode: prefs.mode,
      voice: prefs.voice,
      tone: prefs.tone,
      scenesCount: draft.length,
      scenesOverride: draft,
    });
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
          <Card className="mb-4 border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
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
              <Button onClick={handleStart} disabled={!bookId || draft.some(s => !s.narration.trim())} className="flex-1">
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
          <Card className="flex flex-col items-center gap-5 p-10 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {status === "pending"
                ? "Seu vídeo entrou na fila. A geração inicia em instantes."
                : "Montando seu vídeo parte por parte."}
            </p>

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
          </Card>
        )}

        {result && <ScenePlayer scenes={result.scenes} title={result.title} draft={draft} mode={prefs.mode} voice={prefs.voice} tone={prefs.tone} />}
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
