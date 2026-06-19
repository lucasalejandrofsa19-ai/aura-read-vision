import { useState } from "react";
import { pdfjs } from "react-pdf";
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";

// Worker is configured globally in src/lib/pdfjsWorker.ts

export const useGenerateCover = () => {
  const [generating, setGenerating] = useState(false);

  const generateCover = async (bookId: string, fileUrl: string, pageNumber: number = 1) => {
    setGenerating(true);

    try {
      if (!bookId) throw new Error("bookId inválido");

      // Load PDF
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;

      if (pageNumber > pdf.numPages) {
        throw new Error(`Página ${pageNumber} não existe. O PDF tem ${pdf.numPages} páginas`);
      }

      // Render page as small JPEG (miniatura)
      const page = await pdf.getPage(pageNumber);
      const scale = 1.2;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Não foi possível criar contexto do canvas");

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: context, viewport }).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Falha ao converter canvas para blob"))),
          "image/jpeg",
          0.82
        );
      });

      // Validações do blob antes do upload
      if (!blob || blob.size === 0) {
        throw new Error("Blob da capa vazio — render do PDF falhou");
      }
      if (blob.type !== "image/jpeg") {
        throw new Error(`Tipo inesperado do blob: ${blob.type} (esperado image/jpeg)`);
      }
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (blob.size > MAX_SIZE) {
        throw new Error(`Capa excede 5MB (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
      }

      // Upload direto cliente -> Storage
      const coverFileName = `${bookId}-cover.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("premium-covers")
        .upload(coverFileName, blob, {
          contentType: "image/jpeg",
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;
      if (!uploadData?.path) {
        throw new Error("Upload não retornou path do arquivo");
      }

      // Confirma que o objeto realmente existe no bucket
      const { data: listed, error: listError } = await supabase.storage
        .from("premium-covers")
        .list("", { search: coverFileName, limit: 1 });

      if (listError) throw listError;
      const found = listed?.find((o) => o.name === coverFileName);
      if (!found) {
        throw new Error("Capa não encontrada no bucket após upload");
      }
      const uploadedSize = (found.metadata as { size?: number } | null)?.size;
      if (typeof uploadedSize === "number" && uploadedSize !== blob.size) {
        throw new Error(
          `Tamanho divergente: enviado ${blob.size}B, gravado ${uploadedSize}B`
        );
      }

      // Atualiza o registro do livro com o caminho da capa
      const { data: updated, error: updateError } = await supabase
        .from("books")
        .update({ cover_image_url: coverFileName })
        .eq("id", bookId)
        .select("id, cover_image_url")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) {
        throw new Error("Livro não encontrado ou sem permissão para atualizar");
      }
      if (updated.cover_image_url !== coverFileName) {
        throw new Error(
          `Caminho salvo (${updated.cover_image_url}) não corresponde ao arquivo (${coverFileName})`
        );
      }

      return { success: true, coverImageUrl: coverFileName, size: blob.size };
    } catch (error) {
      captureError(error, { context: "generate_cover" });
      throw error;
    } finally {
      setGenerating(false);
    }
  };

  return { generateCover, generating };
};
