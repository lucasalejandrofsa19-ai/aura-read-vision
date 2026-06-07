import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Loader2, Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StoryVideoRow {
  id: string;
  book_title: string | null;
  mode: string | null;
  scenes_count: number | null;
  file_path: string | null;
  file_size: number | null;
  file_mime: string | null;
  created_at: string;
}

function formatBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const MyStoryVideos = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<StoryVideoRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("story_videos" as any)
      .select("id, book_title, mode, scenes_count, file_path, file_size, file_mime, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Não foi possível carregar seus vídeos");
    }
    setVideos((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleDownload = async (v: StoryVideoRow) => {
    if (!v.file_path) { toast.error("Vídeo sem arquivo salvo"); return; }
    setBusyId(v.id);
    try {
      const { data, error } = await supabase.storage
        .from("story-videos")
        .createSignedUrl(v.file_path, 60 * 10);
      if (error || !data?.signedUrl) throw error || new Error("Sem URL");
      const ext = v.file_mime === "video/webm" ? "webm" : "mp4";
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = `${(v.book_title || "historia").replace(/[^\w\-]+/g, "_")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      toast.error("Erro ao baixar: " + (e?.message || ""));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (v: StoryVideoRow) => {
    if (!confirm(`Excluir "${v.book_title || "vídeo"}"?`)) return;
    setBusyId(v.id);
    try {
      if (v.file_path) {
        await supabase.storage.from("story-videos").remove([v.file_path]);
      }
      const { error } = await supabase.from("story_videos" as any).delete().eq("id", v.id);
      if (error) throw error;
      setVideos(prev => prev.filter(x => x.id !== v.id));
      toast.success("Vídeo excluído");
    } catch (e: any) {
      toast.error("Erro ao excluir: " + (e?.message || ""));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (videos.length === 0) {
    return (
      <Card className="p-8 text-center space-y-2">
        <Clapperboard className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="font-medium">Nenhum vídeo gerado ainda</p>
        <p className="text-sm text-muted-foreground">
          Crie histórias em vídeo na página Histórias em Vídeo IA — elas aparecem aqui para você baixar quando quiser.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {videos.map(v => (
        <Card key={v.id} className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Clapperboard className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{v.book_title || "Vídeo sem título"}</p>
            <p className="text-xs text-muted-foreground">
              {v.scenes_count || 0} cenas · {formatBytes(v.file_size)} ·{" "}
              {formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleDownload(v)}
            disabled={busyId === v.id || !v.file_path}
          >
            {busyId === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(v)}
            disabled={busyId === v.id}
            aria-label="Excluir vídeo"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </Card>
      ))}
    </div>
  );
};
