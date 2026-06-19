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
      // Load PDF
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;

      if (pageNumber > pdf.numPages) {
        throw new Error(`Página ${pageNumber} não existe. O PDF tem ${pdf.numPages} páginas`);
      }

      // Render first page as a small JPEG (miniatura)
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

      // Upload direto cliente -> Storage (sem base64, sem edge function intermediária)
      const coverFileName = `${bookId}-cover.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("premium-covers")
        .upload(coverFileName, blob, {
          contentType: "image/jpeg",
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      // Atualiza o registro do livro com o caminho da capa
      const { error: updateError } = await supabase
        .from("books")
        .update({ cover_image_url: coverFileName })
        .eq("id", bookId);

      if (updateError) throw updateError;

      return { success: true, coverImageUrl: coverFileName };
    } catch (error) {
      captureError(error, { context: "generate_cover" });
      throw error;
    } finally {
      setGenerating(false);
    }
  };

  return { generateCover, generating };
};
