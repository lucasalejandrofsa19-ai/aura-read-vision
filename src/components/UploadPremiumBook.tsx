import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, BookOpen } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useQueryClient } from "@tanstack/react-query";
import { sanitizeFileName } from "@/lib/sanitizeFileName";
import { validatePdfFile } from "@/lib/validatePdfFile";
import { uploadWithProgress, UPLOAD_CANCELLED } from "@/lib/uploadWithProgress";

// Mesmos padrões do UploadPDF: retry automático com backoff em falhas de rede.
const isRetriableUploadError = (msg: string) =>
  /Tempo esgotado no upload|Conexão instável|Conexão perdida/i.test(msg);

const formatETA = (seconds: number): string => {
  if (!isFinite(seconds) || seconds <= 0) return "calculando…";
  if (seconds < 60) return `~${Math.ceil(seconds)}s restantes`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `~${m}m ${s}s restantes`;
};

const formatSpeed = (bps: number): string => {
  if (bps > 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${Math.round(bps)} B/s`;
};

export const UploadPremiumBook = () => {
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [summary, setSummary] = useState("");
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);

  if (!isAdmin) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    // Validações unificadas com UploadPDF (extensão + 50MB + magic bytes)
    const validation = await validatePdfFile(selectedFile);
    if (validation.ok === false) {
      toast.error(validation.title, { description: validation.description });
      return;
    }
    setFile(selectedFile);
  };

  const runUpload = async (
    selectedFile: File,
    meta: { title: string; author: string; summary: string },
  ) => {
    if (!selectedFile || !meta.title.trim()) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    setUploading(true);
    setProgress(0);
    cancelledRef.current = false;

    const toastId = `premium-upload-${Date.now()}`;
    const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(1);

    const cancelUpload = () => {
      cancelledRef.current = true;
      uploadXhrRef.current?.abort();
      toast.info("Upload cancelado", { id: toastId, description: selectedFile.name });
    };

    const toastActions = { action: { label: "Cancelar", onClick: cancelUpload } } as const;

    toast.loading("Preparando envio…", {
      id: toastId,
      description: `${selectedFile.name} • ${fileSizeMB} MB`,
      ...toastActions,
    });

    let uploadedPath: string | null = null;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

      const safeName = sanitizeFileName(selectedFile.name);
      const fileName = `${Date.now()}-${safeName}`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/premium-pdfs/${fileName}`;

      // Retry automático com backoff exponencial para falhas transitórias.
      const MAX_ATTEMPTS = 3;
      const BACKOFF_MS = [2000, 5000];
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          if (attempt > 1) {
            const delay = BACKOFF_MS[attempt - 2] ?? 5000;
            toast.loading(`Reconectando (tentativa ${attempt}/${MAX_ATTEMPTS})…`, {
              id: toastId,
              description: `Aguardando ${Math.round(delay / 1000)}s antes de tentar novamente`,
              ...toastActions,
            });
            await new Promise((r) => setTimeout(r, delay));
            if (cancelledRef.current) throw new Error(UPLOAD_CANCELLED);
            setProgress(0);
          }

          await uploadWithProgress({
            url: uploadUrl,
            file: selectedFile,
            accessToken,
            contentType: "application/pdf",
            upsert: false,
            registerXhr: (xhr) => { uploadXhrRef.current = xhr; },
            onProgress: ({ pct, bytesPerSecond, etaSeconds, loaded }) => {
              setProgress(pct);
              const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
              const status =
                pct < 5 ? "Conectando…" : pct < 100 ? "Enviando" : "Finalizando envio";
              toast.loading(`${status} • ${pct}%`, {
                id: toastId,
                description: `${loadedMB}/${fileSizeMB} MB • ${formatSpeed(bytesPerSecond)} • ${formatETA(etaSeconds)}`,
                ...toastActions,
              });
            },
          });
          break;
        } catch (err: any) {
          const msg = err?.message ?? "";
          if (cancelledRef.current || msg === UPLOAD_CANCELLED) throw err;
          if (!isRetriableUploadError(msg) || attempt >= MAX_ATTEMPTS) throw err;
        }
      }

      uploadedPath = fileName;
      setProgress(100);
      toast.loading("Salvando na biblioteca premium… 💾", {
        id: toastId,
        description: `${selectedFile.name} • registrando metadados`,
      });

      const { data: bookData, error: insertError } = await supabase
        .from("premium_books")
        .insert({
          title: meta.title.trim(),
          author: meta.author.trim() || null,
          summary: meta.summary.trim() || null,
          file_path: fileName,
          file_size: selectedFile.size,
        })
        .select()
        .single();

      if (insertError) {
        if (uploadedPath) {
          await supabase.storage.from("premium-pdfs").remove([uploadedPath]).catch(() => {});
        }
        throw insertError;
      }

      toast.success("Livro premium adicionado! Processando PDF...", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["premium-books"] });

      // Processar PDF em background
      supabase.functions
        .invoke("process-premium-pdf", { body: { bookId: bookData.id } })
        .then(({ data, error }) => {
          if (error) {
            console.error("Error processing PDF:", error);
            toast.error("PDF adicionado, mas houve erro no processamento");
          } else {
            toast.success(`PDF processado: ${data?.totalPages ?? "?"} páginas extraídas`);
            queryClient.invalidateQueries({ queryKey: ["premium-books"] });
          }
        });

      setOpen(false);
      setFile(null);
      setTitle("");
      setAuthor("");
      setSummary("");
    } catch (error: any) {
      if (cancelledRef.current || error?.message === UPLOAD_CANCELLED) {
        if (uploadedPath) {
          await supabase.storage.from("premium-pdfs").remove([uploadedPath]).catch(() => {});
        }
      } else {
        console.error("Error uploading premium book:", error);
        const msg = error?.message || "Não conseguimos enviar o PDF. Tente novamente.";
        const retriable = isRetriableUploadError(msg);
        toast.error(retriable ? "Falha no upload após várias tentativas" : "Falha no upload", {
          id: toastId,
          description: retriable
            ? `${msg} Toque em "Tentar novamente" para reenviar ${selectedFile.name}.`
            : msg,
          duration: retriable ? 15000 : 6000,
          action: retriable
            ? { label: "Tentar novamente", onClick: () => void runUpload(selectedFile, meta) }
            : undefined,
        });
      }
    } finally {
      uploadXhrRef.current = null;
      setUploading(false);
      setProgress(0);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    void runUpload(file, { title, author, summary });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <BookOpen className="w-4 h-4" />
          Adicionar Livro Premium
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Livro Premium</DialogTitle>
          <DialogDescription>
            Adicione um livro que estará disponível para todos os usuários premium
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-file">Arquivo PDF *</Label>
            <Input
              id="pdf-file"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: {file.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Bíblia Sagrada"
              disabled={uploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Autor</Label>
            <Input
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ex: Diversos Autores"
              disabled={uploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Descrição</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Breve descrição do livro..."
              disabled={uploading}
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={uploading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || !file || !title}
            className="relative flex-1 gap-2 overflow-hidden"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Enviando {progress > 0 ? `${progress}%` : "…"}
                {progress > 0 && (
                  <span
                    className="absolute bottom-0 left-0 h-1 bg-primary/70 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Adicionar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
