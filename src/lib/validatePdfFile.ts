import { validatePdfMagicBytes } from "@/lib/validatePdfMagicBytes";

/**
 * Regras compartilhadas de validação de PDF para todos os fluxos de upload
 * (UploadPDF, UploadPremiumBook, etc.). Mantém mensagens idênticas para
 * evitar divergência entre biblioteca comum e premium.
 */

export const MAX_PDF_SIZE_BYTES = 52_428_800; // 50 MB

export type PdfValidationFailure = {
  ok: false;
  /** Título curto do toast. */
  title: string;
  /** Descrição opcional (aparece no toast como subtítulo). */
  description?: string;
  /** Motivo estruturado para telemetria. */
  reason: "not_pdf" | "too_large" | `invalid_magic_bytes_${string}`;
};

export type PdfValidationSuccess = { ok: true };

export type PdfValidationResult = PdfValidationSuccess | PdfValidationFailure;

const isPdfShape = (file: File): boolean =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);

/**
 * Executa TODAS as validações do fluxo padrão do UploadPDF na ordem correta:
 * 1. Extensão/MIME
 * 2. Tamanho (<= 50 MB)
 * 3. Magic bytes (%PDF-)
 */
export async function validatePdfFile(file: File): Promise<PdfValidationResult> {
  if (!isPdfShape(file)) {
    return {
      ok: false,
      title: "Só aceitamos PDFs por aqui.",
      reason: "not_pdf",
    };
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return {
      ok: false,
      title: "Esse PDF passa de 50MB. Tente um arquivo menor.",
      reason: "too_large",
    };
  }

  const magic = await validatePdfMagicBytes(file);
  if (magic.ok === false) {
    return {
      ok: false,
      title: "Arquivo PDF inválido",
      description: magic.message,
      reason: `invalid_magic_bytes_${magic.reason}`,
    };
  }

  return { ok: true };
}
