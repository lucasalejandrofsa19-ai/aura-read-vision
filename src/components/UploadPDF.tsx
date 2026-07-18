import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import { useSentryTracking } from "@/hooks/use-sentry-tracking";
import { useQueryClient } from "@tanstack/react-query";
import { useGenerateCover } from "@/hooks/useGenerateCover";
import { markCoverFailed, clearCoverFailed } from "@/lib/coverFallback";

import { sanitizeFileName } from "@/lib/sanitizeFileName";
import { validatePdfFile } from "@/lib/validatePdfFile";



export interface UploadPDFHandle {
  openPicker: () => void;
}

interface UploadPDFProps {
  onUploadComplete?: () => void;
}

const UploadPDF = forwardRef<UploadPDFHandle, UploadPDFProps>(({ onUploadComplete } = {}, ref) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);
  const fallbackRetriesRef = useRef(0);
  const MAX_FALLBACK_RETRIES = 2;
  const { user } = useAuth();
  const { hasPremiumAccess, isAdmin } = useUserData();
  const { trackClick, trackAsyncOperation } = useSentryTracking();
  const queryClient = useQueryClient();
  const { generateCover } = useGenerateCover();

  useImperativeHandle(ref, () => ({
    openPicker: () => fileInputRef.current?.click(),
  }), []);


  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    await startUpload(file);
  };

  // Erros de rede/latência que valem uma retentativa automática.
  const isRetriableUploadError = (msg: string) =>
    /Tempo esgotado no upload|Conexão instável|Conexão perdida/i.test(msg);

  const startUpload = async (file: File) => {
    if (!user) {
      toast.error("Faça login para começar sua biblioteca.");
      return;
    }

    trackClick("pdf_upload_file_selected", {
      fileSize: file.size,
      fileType: file.type,
    });

    // Validações unificadas (extensão + 50MB + magic bytes %PDF-)
    const validation = await validatePdfFile(file);
    if (!validation.ok) {
      toast.error(validation.title, {
        description: validation.description,
      });
      trackClick("pdf_upload_validation_failed", { reason: validation.reason });
      return;
    }


    // Sem limite de ebooks — uploads liberados para todos os planos.



    setUploading(true);
    setProgress(0);
    cancelledRef.current = false;
    const toastId = `pdf-upload-${Date.now()}`;
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

    const cancelUpload = () => {
      cancelledRef.current = true;
      uploadXhrRef.current?.abort();
      toast.info("Upload cancelado", { id: toastId, description: file.name });
    };

    const toastActions = {
      action: { label: "Cancelar", onClick: cancelUpload },
    } as const;

    toast.loading("Preparando envio…", {
      id: toastId,
      description: `${file.name} • ${fileSizeMB} MB`,
      ...toastActions,
    });

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

    await trackAsyncOperation(
      "pdf_upload_complete_flow",
      async () => {
        let uploadedPath: string | null = null;
        try {
          // Path seguro (sanitiza nome)
          const safeName = sanitizeFileName(file.name);
          const fileName = `${user.id}/${Date.now()}-${safeName}`;

          // Upload com progresso real via XHR
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const uploadUrl = `${supabaseUrl}/storage/v1/object/pdfs/${fileName}`;

          const performXhrUpload = () => new Promise<void>((resolve, reject) => {
            const startTime = Date.now();
            const xhr = new XMLHttpRequest();
            uploadXhrRef.current = xhr;
            xhr.open("POST", uploadUrl);
            xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
            xhr.setRequestHeader("Content-Type", "application/pdf");
            xhr.setRequestHeader("x-upsert", "false");
            // 5min timeout evita loading eterno em redes travadas
            xhr.timeout = 5 * 60 * 1000;
            let lastProgressAt = Date.now();
            let stallWatchdog: number | undefined;
            const clearWatchdog = () => {
              if (stallWatchdog !== undefined) {
                window.clearInterval(stallWatchdog);
                stallWatchdog = undefined;
              }
            };
            // Detecta stall (sem progresso por 45s) e aborta com mensagem clara
            stallWatchdog = window.setInterval(() => {
              if (Date.now() - lastProgressAt > 45_000) {
                clearWatchdog();
                try { xhr.abort(); } catch {}
                reject(new Error("Conexão instável — upload pausou por muito tempo."));
              }
            }, 5000);
            xhr.upload.onprogress = (e) => {
              lastProgressAt = Date.now();
              if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                setProgress(pct);
                const elapsed = (Date.now() - startTime) / 1000;
                const bps = elapsed > 0 ? e.loaded / elapsed : 0;
                const remaining = bps > 0 ? (e.total - e.loaded) / bps : Infinity;
                const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
                const status =
                  pct < 5 ? "Conectando…" : pct < 100 ? "Enviando" : "Finalizando envio";
                toast.loading(`${status} • ${pct}%`, {
                  id: toastId,
                  description: `${loadedMB}/${fileSizeMB} MB • ${formatSpeed(bps)} • ${formatETA(remaining)}`,
                  ...toastActions,
                });
              }
            };
            xhr.onload = () => {
              clearWatchdog();
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else {
                let msg = `Falha no upload (HTTP ${xhr.status})`;
                try {
                  const body = JSON.parse(xhr.responseText);
                  if (body?.message) msg = body.message;
                } catch {}
                if (xhr.status === 409) msg = "Já existe um arquivo com esse nome — tente novamente.";
                if (xhr.status === 401 || xhr.status === 403) msg = "Sessão expirada. Faça login novamente.";
                reject(new Error(msg));
              }
            };
            xhr.onerror = () => { clearWatchdog(); reject(new Error("Conexão perdida durante o upload.")); };
            xhr.ontimeout = () => { clearWatchdog(); reject(new Error("Tempo esgotado no upload. Verifique sua conexão.")); };
            xhr.onabort = () => { clearWatchdog(); reject(new Error("__UPLOAD_CANCELLED__")); };
            xhr.send(file);
          });

          // Retry automático com backoff exponencial para falhas transitórias
          // (timeout, stall e conexão perdida). Erros de sessão/HTTP 4xx e
          // cancelamento pelo usuário não são retentados.
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
                if (cancelledRef.current) throw new Error("__UPLOAD_CANCELLED__");
                setProgress(0);
              }
              await performXhrUpload();
              break;
            } catch (err: any) {
              const msg = err?.message ?? "";
              if (cancelledRef.current || msg === "__UPLOAD_CANCELLED__") throw err;
              if (!isRetriableUploadError(msg) || attempt >= MAX_ATTEMPTS) throw err;
              // continua para próxima tentativa
            }
          }



          uploadedPath = fileName;
          setProgress(100);
          toast.loading("Salvando na biblioteca… 💾", {
            id: toastId,
            description: `${file.name} • registrando metadados`,
          });

          // Cor aleatória de capa
          const colors = [
            "from-blue-500 to-blue-700",
            "from-amber-500 to-amber-700",
            "from-purple-500 to-purple-700",
            "from-green-500 to-green-700",
            "from-red-500 to-red-700",
            "from-cyan-500 to-cyan-700",
          ];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];

          // Registrar no banco
          const { data: bookData, error: insertError } = await supabase
            .from("books")
            .insert({
              user_id: user.id,
              title: file.name.replace(/\.pdf$/i, ""),
              file_path: fileName,
              file_size: file.size,
              cover_color: randomColor,
            })
            .select()
            .single();

          if (insertError) {
            // Rollback do storage se o insert falhar
            if (uploadedPath) {
              await supabase.storage.from("pdfs").remove([uploadedPath]).catch(() => {});
            }
            throw insertError;
          }

          toast.success("Pronto! Seu PDF está na biblioteca.", {
            id: toastId,
            description: file.name,
          });


          // Invalidar query imediatamente para mostrar o card com loading
          queryClient.invalidateQueries({ queryKey: ["books", user.id] });

          // Generate cover from first page in the background
          fallbackRetriesRef.current = 0;
          const generateCoverAsync = async (isRetry = false): Promise<void> => {
            if (!isRetry) fallbackRetriesRef.current = 0;
            try {
              toast.loading("Preparando a capa…", { id: "cover-generation" });

              // Get a signed URL for the PDF (private bucket)
              const { data: signedData } = await supabase.storage
                .from("pdfs")
                .createSignedUrl(fileName, 60 * 60);

              const result = await generateCover(bookData.id, signedData?.signedUrl ?? "", 1);
              if (result?.fallback) {
                const canRetry = fallbackRetriesRef.current < MAX_FALLBACK_RETRIES;
                if (canRetry) {
                  toast.warning(
                    `Não foi possível verificar a capa — usando fallback (tentativa ${fallbackRetriesRef.current + 1}/${MAX_FALLBACK_RETRIES})`,
                    {
                      id: "cover-generation",
                      duration: 10000,
                      action: {
                        label: "Tentar novamente",
                        onClick: () => {
                          fallbackRetriesRef.current += 1;
                          void generateCoverAsync(true);
                        },
                      },
                    }
                  );
                } else {
                  toast.info(
                    "Limite de tentativas atingido. Tente gerar a capa novamente mais tarde.",
                    { id: "cover-generation", duration: 10000 }
                  );
                  fallbackRetriesRef.current = 0;
                  markCoverFailed(bookData.id);
                }
              } else {
                fallbackRetriesRef.current = 0;
                clearCoverFailed(bookData.id);
                toast.success("Capa pronta ✨", { id: "cover-generation" });
              }
              queryClient.invalidateQueries({ queryKey: ["books", user.id] });
            } catch (error) {
              captureError(error, { context: "auto_generate_cover" });
              const canRetry = fallbackRetriesRef.current < MAX_FALLBACK_RETRIES;
              if (!canRetry) markCoverFailed(bookData.id);
              queryClient.invalidateQueries({ queryKey: ["books", user.id] });
              toast.error(
                canRetry
                  ? "Não conseguimos gerar a capa agora."
                  : "Não conseguimos gerar a capa — usando placeholder.",
                {
                  id: "cover-generation",
                  action: canRetry
                    ? {
                        label: "Tentar novamente",
                        onClick: () => {
                          fallbackRetriesRef.current += 1;
                          void generateCoverAsync(true);
                        },
                      }
                    : undefined,
                }
              );
            }
          };

          // Execute asynchronously without blocking
          generateCoverAsync();
          
          // Chamar callback se fornecido
          if (onUploadComplete) {
            onUploadComplete();
          }

          // Reset input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (error: any) {
          if (cancelledRef.current || error?.message === "__UPLOAD_CANCELLED__") {
            // Cancelado pelo usuário — limpar storage se já enviado
            if (uploadedPath) {
              await supabase.storage.from("pdfs").remove([uploadedPath]).catch(() => {});
            }
            // toast.info já exibido em cancelUpload()
          } else {
            captureError(error, { context: "pdf_upload" });
            const msg = error?.message || "Não conseguimos enviar seu PDF. Tente novamente.";
            const retriable = isRetriableUploadError(msg);
            toast.error(retriable ? "Falha no upload após várias tentativas" : "Falha no upload", {
              id: toastId,
              description: retriable
                ? `${msg} Toque em "Tentar novamente" para reenviar ${file.name}.`
                : msg,
              duration: retriable ? 15000 : 6000,
              action: retriable
                ? {
                    label: "Tentar novamente",
                    onClick: () => {
                      trackClick("pdf_upload_manual_retry", { fileName: file.name });
                      void startUpload(file);
                    },
                  }
                : undefined,
            });
          }
        } finally {
          uploadXhrRef.current = null;
          setUploading(false);
          setProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      {
        fileSize: file.size,
        fileName: file.name,
      }
    );
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        size="lg"
        disabled={uploading}
        className="relative rounded-full w-16 h-16 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity aura-amber shadow-2xl overflow-hidden"
        onClick={() => {
          trackClick("pdf_upload_button");
          fileInputRef.current?.click();
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {progress > 0 && (
              <span className="text-[10px] font-semibold text-white mt-0.5">{progress}%</span>
            )}
          </div>
        ) : (
          <Upload className="w-6 h-6" />
        )}
        {uploading && progress > 0 && (
          <div
            className="absolute bottom-0 left-0 h-1 bg-white/80 transition-all"
            style={{ width: `${progress}%` }}
          />
        )}
      </Button>
    </>
  );
});
UploadPDF.displayName = "UploadPDF";

export default UploadPDF;
