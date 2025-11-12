import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { pdfUploadSchema, bookTitleSchema, validateData } from "@/lib/validations";
import { captureError } from "@/lib/sentry";

interface UploadPDFProps {
  onUploadComplete: () => void;
}

const UploadPDF = ({ onUploadComplete }: UploadPDFProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, subscriptionTier } = useAuth();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file with zod schema
    const fileValidation = validateData(pdfUploadSchema, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    if (!fileValidation.success) {
      toast.error(fileValidation.errors[0]);
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

    try {
      // Upload to storage
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Validate and sanitize book title
      const bookTitle = file.name.replace(".pdf", "");
      const titleValidation = validateData(bookTitleSchema, bookTitle);
      
      if (!titleValidation.success) {
        toast.error("Nome do arquivo inválido");
        return;
      }

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
          title: titleValidation.data,
          file_path: fileName,
          file_size: file.size,
          cover_color: randomColor,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Process PDF in background (extract text) with auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        supabase.functions
          .invoke("process-pdf", {
            body: {
              bookId: bookData.id,
              filePath: fileName,
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          })
          .catch((error) => captureError(error, "PDF processing"));
      }

      toast.success("PDF adicionado com sucesso!");
      onUploadComplete();

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      captureError(error, "PDF upload");
      toast.error("Erro ao fazer upload do PDF");
    } finally {
      setUploading(false);
    }
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
        onClick={() => fileInputRef.current?.click()}
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
