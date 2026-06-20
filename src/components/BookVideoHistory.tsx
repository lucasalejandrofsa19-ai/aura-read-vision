import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Download, Share2, RefreshCw, Video } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  status: string;
  created_at: string;
  file_path: string | null;
  file_size: number | null;
  file_mime: string | null;
  scenes_count: number | null;
  mode: string | null;
  error_message: string | null;
};

type Props = { bookId: string; refreshKey?: number };

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ok: { label: "Concluído", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  processing: { label: "Processando", variant: "secondary" },
  error: { label: "Falha", variant: "destructive" },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function BookVideoHistory({ bookId, refreshKey }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("story_videos")
      .select("id, status, created_at, file_path, file_size, file_mime, scenes_count, mode, error_message")
      .eq("book_id", bookId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) toast.error("Não foi possível carregar o histórico.");
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [bookId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const getSignedUrl = useCallback(async (path: string) => {
    const { data, error } = await supabase.storage.from("story-videos").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw new Error(error?.message || "URL inválida");
    return data.signedUrl;
  }, []);

  const handlePlay = async (row: Row) => {
    if (!row.file_path) return;
    setBusyId(row.id);
    try {
      const url = await getSignedUrl(row.file_path);
      setOpenId(row.id);
      setOpenUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir vídeo.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (row: Row) => {
    if (!row.file_path) return;
    setBusyId(row.id);
    try {
      const url = await getSignedUrl(row.file_path);
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const isJson = (row.file_mime || "").includes("json") || row.file_path.endsWith(".json");
      a.download = `video-${row.id.slice(0, 8)}.${isJson ? "json" : "mp4"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success("Download iniciado. Salve na sua galeria.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no download.");
    } finally {
      setBusyId(null);
    }
  };

  const handleShare = async (row: Row) => {
    if (!row.file_path) return;
    setBusyId(row.id);
    try {
      const url = await getSignedUrl(row.file_path);
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
      if (nav.share) {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const file = new File([blob], `video-${row.id.slice(0, 8)}.mp4`, { type: blob.type || "video/mp4" });
          if (nav.canShare?.({ files: [file] })) {
            await nav.share({ files: [file], title: "Vídeo do livro" });
            return;
          }
          await nav.share({ url, title: "Vídeo do livro" });
          return;
        } catch { /* fallback to clipboard */ }
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado (válido por 1h).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao compartilhar.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Histórico de vídeos</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} title="Atualizar">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">Nenhum vídeo gerado para este livro ainda.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const meta = STATUS[row.status] ?? { label: row.status, variant: "outline" as const };
            const playable = row.status === "ok" && !!row.file_path;
            const isOpen = openId === row.id && openUrl;
            return (
              <li key={row.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      {formatDate(row.created_at)}
                      {row.scenes_count ? ` · ${row.scenes_count} cenas` : ""}
                      {row.file_size ? ` · ${formatSize(row.file_size)}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" disabled={!playable || busyId === row.id} onClick={() => handlePlay(row)}>
                      {busyId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      <span className="ml-1 hidden sm:inline">Ver</span>
                    </Button>
                    <Button size="sm" variant="outline" disabled={!playable || busyId === row.id} onClick={() => handleDownload(row)}>
                      <Download className="h-3 w-3" />
                      <span className="ml-1 hidden sm:inline">Baixar</span>
                    </Button>
                    <Button size="sm" variant="outline" disabled={!playable || busyId === row.id} onClick={() => handleShare(row)}>
                      <Share2 className="h-3 w-3" />
                      <span className="ml-1 hidden sm:inline">Compartilhar</span>
                    </Button>
                  </div>
                </div>
                {row.status === "error" && row.error_message && (
                  <p className="text-[11px] text-destructive break-words">{row.error_message}</p>
                )}
                {isOpen && (
                  (row.file_mime || "").includes("json") || (row.file_path || "").endsWith(".json")
                    ? <iframe src={openUrl!} title="Roteiro" className="w-full h-72 rounded-md border border-border bg-background" />
                    : <video src={openUrl!} controls className="w-full rounded-md bg-black" preload="metadata" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default BookVideoHistory;
