import { useState, useRef } from "react";
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

interface UploadPDFProps {
  onUploadComplete?: () => void;
}

const UploadPDF = ({ onUploadComplete }: UploadPDFProps = {}) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { hasPremiumAccess, isAdmin } = useUserData();
  const { trackClick, trackAsyncOperation } = useSentryTracking();
  const queryClient = useQueryClient();
  const { generateCover } = useGenerateCover();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      if (!user) toast.error("Faça login para adicionar PDFs");
      return;
    }

    trackClick("pdf_upload_file_selected", {
      fileSize: file.size,
      fileType: file.type,
    });

    // Validar tipo (alguns navegadores não setam file.type)
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    // Limite de 50MB
    if (file.size > 52428800) {
      toast.error("Arquivo muito grande. Limite de 50MB");
      return;
    }

    // Limites por plano
    const { count, error: countError } = await supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      toast.error("Não foi possível verificar sua biblioteca. Tente novamente.");
      return;
    }

    const maxBooks = isAdmin || hasPremiumAccess ? 1000 : 5;
    if ((count || 0) >= maxBooks) {
      toast.error(
        hasPremiumAccess || isAdmin
          ? `Limite de ${maxBooks} livros atingido.`
          : `Limite de ${maxBooks} livros atingido. Faça upgrade para adicionar mais!`
      );
      return;
    }

    setUploading(true);

    await trackAsyncOperation(
      "pdf_upload_complete_flow",
      async () => {
        let uploadedPath: string | null = null;
        try {
          // Path seguro (sanitiza nome)
          const safeName = sanitizeFileName(file.name);
          const fileName = `${user.id}/${Date.now()}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from("pdfs")
            .upload(fileName, file, {
              contentType: "application/pdf",
              upsert: false,
            });

          if (uploadError) throw uploadError;
          uploadedPath = fileName;

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

          toast.success("PDF adicionado com sucesso!");


          // Invalidar query imediatamente para mostrar o card com loading
          queryClient.invalidateQueries({ queryKey: ["books", user.id] });

          // Generate cover from first page in the background
          const generateCoverAsync = async () => {
            try {
              toast.loading("Gerando capa da primeira página...", { id: "cover-generation" });
              
              // Get a signed URL for the PDF (private bucket)
              const { data: signedData } = await supabase.storage
                .from("pdfs")
                .createSignedUrl(fileName, 60 * 60);

              await generateCover(bookData.id, signedData?.signedUrl ?? "", 1);
              toast.success("✨ Capa gerada com sucesso!", { id: "cover-generation" });
              queryClient.invalidateQueries({ queryKey: ["books", user.id] });
            } catch (error) {
              captureError(error, { context: "auto_generate_cover" });
              toast.error("Erro ao gerar capa", { id: "cover-generation" });
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
          const msg = error?.message || "Erro ao fazer upload do PDF";
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
};

export default UploadPDF;
