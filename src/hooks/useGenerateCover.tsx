import { useState } from "react";
import { pdfjs } from "react-pdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

      // Get page
      const page = await pdf.getPage(pageNumber);

      // Capa é miniatura — scale 1.2 é suficiente. JPEG com qualidade 0.82
      // gera um blob ~20x menor que PNG@2.0, mantendo qualidade visual ótima.
      const scale = 1.2;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });

      if (!context) {
        throw new Error("Não foi possível criar contexto do canvas");
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Fundo branco para evitar transparência preta no JPEG
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Render page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Convert canvas to JPEG blob (muito menor que PNG)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Falha ao converter canvas para blob"));
        }, 'image/jpeg', 0.82);
      });


      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const base64Image = await base64Promise;

      // Send to backend to save
      const { data, error } = await supabase.functions.invoke('process-pdf', {
        body: {
          bookId,
          coverImage: base64Image,
        },
      });

      if (error) throw error;

      return data;
      
    } catch (error) {
      captureError(error, { context: 'generate_cover' });
      throw error;
    } finally {
      setGenerating(false);
    }
  };

  return { generateCover, generating };
};
