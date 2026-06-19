import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useStoryVideoJob, type Scene } from "@/hooks/useStoryVideoJob";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Play, Pause, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";

const statusLabel: Record<string, string> = {
  idle: "Pronto",
  pending: "Na fila…",
  processing: "Gerando cenas (roteiro + imagens + narração)…",
  completed: "Pronto!",
  failed: "Falhou",
};

export default function StoryVideo() {
  const { bookId = "" } = useParams();
  const { status, error, result, attempts, start } = useStoryVideoJob();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!bookId || startedRef.current) return;
    startedRef.current = true;
    start({ book_id: bookId, mode: "summary", scenesCount: 5 });
  }, [bookId, start]);

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
          <Card className="border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </Card>
        )}

        {!result && !error && (
          <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {status === "pending"
                ? "Seu vídeo entrou na fila. Isso leva 1–3 minutos."
                : "Gerando roteiro, imagens e narração…"}
            </p>
          </Card>
        )}

        {result && <ScenePlayer scenes={result.scenes} title={result.title} />}
      </div>
    </main>
  );
}

function ScenePlayer({ scenes, title }: { scenes: Scene[]; title: string }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scene = scenes[idx];
  const segImages = useMemo(() => scene?.segments.map(s => s.imageDataUrl).filter(Boolean) ?? [], [scene]);
  const [segIdx, setSegIdx] = useState(0);

  useEffect(() => { setSegIdx(0); }, [idx]);

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

  // image rotation within scene synced to audio duration
  useEffect(() => {
    if (!playing || segImages.length <= 1) return;
    const a = audioRef.current;
    const dur = a?.duration && isFinite(a.duration) ? a.duration : 10;
    const per = (dur / segImages.length) * 1000;
    const t = window.setInterval(() => setSegIdx(i => (i + 1) % segImages.length), per);
    return () => window.clearInterval(t);
  }, [playing, segImages.length, idx]);

  if (!scene) return null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="relative aspect-video w-full bg-muted">
          {segImages[segIdx] ? (
            <img src={segImages[segIdx]} alt={scene.chapterTitle} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">Sem imagem</div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
            <p className="text-xs uppercase tracking-wide opacity-80">{title}</p>
            <h2 className="text-lg font-semibold">{scene.chapterTitle}</h2>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{scene.segments[segIdx]?.text ?? scene.narration}</p>
          <audio ref={audioRef} src={scene.audioDataUrl} preload="auto" />
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button onClick={() => setPlaying(p => !p)} className="flex-1">
              {playing ? <><Pause className="mr-2 h-4 w-4" /> Pausar</> : <><Play className="mr-2 h-4 w-4" /> Reproduzir</>}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setIdx(i => Math.min(scenes.length - 1, i + 1))} disabled={idx === scenes.length - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Cena {idx + 1} / {scenes.length}
          </p>
        </div>
      </Card>
    </div>
  );
}
