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

// Remove acentos e caracteres não suportados pelo Supabase Storage
const sanitizeFileName = (name: string) => {
  const base = name.replace(/\.pdf$/i, "");
  const clean = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "documento";
  return `${clean}.pdf`;
};

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
    if (!file || !user) {
      if (!user) toast.error("Faça login para começar sua biblioteca.");
      return;
    }

    trackClick("pdf_upload_file_selected", {
      fileSize: file.size,
      fileType: file.type,
    });

    // Validar tipo (alguns navegadores não setam file.type)
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      toast.error("Só aceitamos PDFs por aqui.");
      return;
    }

    // Limite de 50MB
    if (file.size > 52428800) {
      toast.error("Esse PDF passa de 50MB. Tente um arquivo menor.");
      return;
    }

    // Limites por plano
    const { count, error: countError } = await supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      toast.error("Não conseguimos checar sua biblioteca agora. Tente em alguns segundos.");
      return;
    }

    const maxBooks = isAdmin || hasPremiumAccess ? 1000 : 5;
    if ((count || 0) >= maxBooks) {
      toast.error(
        hasPremiumAccess || isAdmin
          ? `Você atingiu o limite de ${maxBooks} livros.`
          : `Você chegou ao limite do plano gratuito (${maxBooks} livros). Libere uploads ilimitados no Premium.`
      );
      return;
    }

    setUploading(true);
    setProgress(0);
    const toastId = `pdf-upload-${Date.now()}`;
    toast.loading("Enviando PDF… 0%", { id: toastId, description: file.name });

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

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", uploadUrl);
            xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
            xhr.setRequestHeader("Content-Type", "application/pdf");
            xhr.setRequestHeader("x-upsert", "false");
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                setProgress(pct);
                toast.loading(`Enviando PDF… ${pct}%`, { id: toastId, description: file.name });
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else {
                let msg = `Falha no upload (HTTP ${xhr.status})`;
                try {
                  const body = JSON.parse(xhr.responseText);
                  if (body?.message) msg = body.message;
                } catch {}
                reject(new Error(msg));
              }
            };
            xhr.onerror = () => reject(new Error("Conexão perdida durante o upload."));
            xhr.send(file);
          });

          uploadedPath = fileName;
          setProgress(100);
          toast.loading("Salvando na biblioteca…", { id: toastId, description: file.name });

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
          captureError(error, { context: "pdf_upload" });
          const msg = error?.message || "Não conseguimos enviar seu PDF. Tente novamente.";
          toast.error(msg);
        } finally {
          setUploading(false);
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
        className="rounded-full w-16 h-16 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity aura-amber shadow-2xl"
        onClick={() => {
          trackClick("pdf_upload_button");
          fileInputRef.current?.click();
        }}
      >
        {uploading ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Upload className="w-6 h-6" />
        )}
      </Button>
    </>
  );
});
UploadPDF.displayName = "UploadPDF";

export default UploadPDF;
