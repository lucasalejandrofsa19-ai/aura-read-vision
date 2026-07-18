import { useState } from "react";
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


export const UploadPremiumBook = () => {
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [summary, setSummary] = useState("");

  if (!isAdmin) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const isPdf =
        selectedFile.type === "application/pdf" || /\.pdf$/i.test(selectedFile.name);
      if (!isPdf) {
        toast.error("Por favor, selecione um arquivo PDF");
        return;
      }
      if (selectedFile.size > 52428800) {
        toast.error("Esse PDF passa de 50MB. Tente um arquivo menor.");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    setUploading(true);
    let uploadedPath: string | null = null;

    try {
      // Sanitiza o nome do arquivo (mesma regra do upload comum)
      const safeName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}-${safeName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("premium-pdfs")
        .upload(fileName, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw uploadError;
      uploadedPath = uploadData.path;

      const { data: bookData, error: insertError } = await supabase
        .from("premium_books")
        .insert({
          title: title.trim(),
          author: author.trim() || null,
          summary: summary.trim() || null,
          file_path: uploadData.path,
          file_size: file.size,
        })
        .select()
        .single();

      if (insertError) {
        // Rollback do storage se o insert falhar (mesmo comportamento do UploadPDF)
        if (uploadedPath) {
          await supabase.storage.from("premium-pdfs").remove([uploadedPath]).catch(() => {});
        }
        throw insertError;
      }

      toast.success("Livro premium adicionado! Processando PDF...");

      // Invalida cache imediatamente em vez de recarregar a página
      queryClient.invalidateQueries({ queryKey: ["premium-books"] });

      // Processar PDF em background
      supabase.functions
        .invoke("process-premium-pdf", {
          body: { bookId: bookData.id },
        })
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
      console.error("Error uploading premium book:", error);
      toast.error(`Erro ao fazer upload: ${error?.message ?? "tente novamente"}`);
    } finally {
      setUploading(false);
    }
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
            className="flex-1 gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Enviando...
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
