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
      if (!fileUrl) throw new Error("URL do PDF inválida");

      // Timeout duro para impedir toast eterno se pdf.js travar
      const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
        new Promise<T>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Tempo esgotado: ${label} (${ms}ms)`)), ms);
          p.then((v) => { clearTimeout(timer); resolve(v); })
           .catch((e) => { clearTimeout(timer); reject(e); });
        });

      // Load PDF (cancelável + timeout 45s)
      const loadingTask = pdfjs.getDocument(fileUrl);
      console.info("[generateCover] baixando PDF…", { fileUrl: fileUrl.slice(0, 80) });
      const pdf = await withTimeout(loadingTask.promise, 45_000, "download/parse do PDF");
      console.info("[generateCover] PDF carregado", { numPages: pdf.numPages });

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

      // Confirma que o objeto realmente existe no bucket (com 1 retry exponencial)
      const findUploaded = async () => {
        const { data, error } = await supabase.storage
          .from("premium-covers")
          .list("", { search: coverFileName, limit: 1 });
        if (error) throw error;
        return data?.find((o) => o.name === coverFileName) ?? null;
      };

      let found = await findUploaded();
      if (!found) {
        await new Promise((r) => setTimeout(r, 500));
        found = await findUploaded();
      }

      // Fallback: verificação falhou — preserva capa anterior (ou null = placeholder no BookCard)
      if (!found) {
        const { data: existing } = await supabase
          .from("books")
          .select("cover_image_url")
          .eq("id", bookId)
          .maybeSingle();

        const fallbackPath = existing?.cover_image_url ?? null;
        captureError(
          new Error("Capa não verificada no bucket após retry — usando fallback"),
          { context: "generate_cover_fallback", bookId, fallbackPath }
        );
        return {
          success: false,
          fallback: true as const,
          coverImageUrl: fallbackPath,
          size: blob.size,
        };
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

      return { success: true, fallback: false as const, coverImageUrl: coverFileName, size: blob.size };
    } catch (error) {
      captureError(error, { context: "generate_cover" });
      throw error;
    } finally {
      setGenerating(false);
    }
  };

  return { generateCover, generating };
};
