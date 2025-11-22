import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import { useSentryTracking } from "@/hooks/use-sentry-tracking";
import { useQueryClient } from "@tanstack/react-query";

interface UploadPDFProps {
  onUploadComplete?: () => void;
}

const UploadPDF = ({ onUploadComplete }: UploadPDFProps = {}) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, subscriptionTier } = useAuth();
  const { trackClick, trackAsyncOperation } = useSentryTracking();
  const queryClient = useQueryClient();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    trackClick("pdf_upload_file_selected", {
      fileSize: file.size,
      fileType: file.type,
    });

    // Check file type
    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    // Check file size (50MB limit)
    if (file.size > 52428800) {
      toast.error("Arquivo muito grande. Limite de 50MB");
      return;
    }

    // Check subscription limits
    const { count } = await supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const maxBooks = subscriptionTier === "premium" ? 1000 : subscriptionTier === "pro" ? 100 : 5;
    
    if ((count || 0) >= maxBooks) {
      toast.error(`Limite de ${maxBooks} livros atingido. Faça upgrade para adicionar mais!`);
      return;
    }

    setUploading(true);

    await trackAsyncOperation(
      "pdf_upload_complete_flow",
      async () => {
        try {
          // Upload to storage
          const fileName = `${user.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("pdfs")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Generate random cover color
          const colors = [
            "from-blue-500 to-blue-700",
            "from-amber-500 to-amber-700",
            "from-purple-500 to-purple-700",
            "from-green-500 to-green-700",
            "from-red-500 to-red-700",
            "from-cyan-500 to-cyan-700",
          ];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];

          // Create book record
          const { data: bookData, error: insertError } = await supabase
            .from("books")
            .insert({
              user_id: user.id,
              title: file.name.replace(".pdf", ""),
              file_path: fileName,
              file_size: file.size,
              cover_color: randomColor,
            })
            .select()
            .single();

          if (insertError) throw insertError;

          toast.success("PDF adicionado com sucesso!");

          // Invalidar query imediatamente
          queryClient.invalidateQueries({ queryKey: ["books", user.id] });

          // Generate cover from first page in the background
          toast.loading("Gerando capa da primeira página...", { id: "cover-generation" });
          
          // Get the PDF URL
          const { data: urlData } = supabase.storage
            .from("pdfs")
            .getPublicUrl(fileName);
          
          // Import and use the hook
          import("@/hooks/useGenerateCover").then(({ useGenerateCover }) => {
            const { generateCover } = useGenerateCover();
            
            generateCover(bookData.id, urlData.publicUrl, 1)
              .then(() => {
                toast.success("✨ Capa gerada com sucesso!", { id: "cover-generation" });
                queryClient.invalidateQueries({ queryKey: ["books", user.id] });
              })
              .catch((error) => {
                captureError(error, { context: "auto_generate_cover" });
                toast.dismiss("cover-generation");
              });
          }).catch((error) => {
            captureError(error, { context: "import_generate_cover" });
            toast.dismiss("cover-generation");
          });
          
          // Invalidar query do React Query para atualizar lista automaticamente
          queryClient.invalidateQueries({ queryKey: ["books", user.id] });
          
          // Chamar callback se fornecido
          if (onUploadComplete) {
            onUploadComplete();
          }

          // Reset input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (error) {
          captureError(error, { context: "pdf_upload" });
          toast.error("Erro ao fazer upload do PDF");
        } finally {
          setUploading(false);
        }
      },
      {
        fileSize: file.size,
        subscriptionTier,
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
