/**
 * Valida se um arquivo é um PDF real inspecionando os magic bytes.
 *
 * Um PDF válido começa com "%PDF-" (25 50 44 46 2D). O ISO 32000-1 permite
 * até 1024 bytes de "lixo" antes do header (raro, mas legal), então varremos
 * essa janela inicial para maior compatibilidade.
 *
 * Retornamos um objeto discriminado para permitir mensagens claras ao usuário.
 */

export type PdfMagicBytesResult =
  | { ok: true; version: string }
  | { ok: false; reason: "empty" | "no_signature" | "read_error"; message: string };

const SIGNATURE = "%PDF-";
const SCAN_WINDOW_BYTES = 1024;

export async function validatePdfMagicBytes(file: Blob): Promise<PdfMagicBytesResult> {
  if (!file || file.size === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "Arquivo vazio — selecione um PDF válido.",
    };
  }

  try {
    const slice = file.slice(0, Math.min(SCAN_WINDOW_BYTES, file.size));
    const buffer = await readBlobAsArrayBuffer(slice);
    const bytes = new Uint8Array(buffer);



    // Busca "%PDF-" dentro dos primeiros bytes
    const idx = indexOfSignature(bytes);
    if (idx === -1) {
      return {
        ok: false,
        reason: "no_signature",
        message:
          "Este arquivo não é um PDF real (assinatura %PDF- ausente). Verifique se o arquivo não está corrompido ou renomeado.",
      };
    }

    // Lê a versão logo após "%PDF-" (ex.: "1.7"). Fica só para telemetria.
    const versionBytes = bytes.slice(idx + SIGNATURE.length, idx + SIGNATURE.length + 3);
    const version = new TextDecoder("ascii").decode(versionBytes).trim();
    return { ok: true, version };
  } catch {
    return {
      ok: false,
      reason: "read_error",
      message: "Não foi possível ler o arquivo para validação. Tente novamente.",
    };
}

/**
 * Lê um Blob como ArrayBuffer com compatibilidade máxima:
 * tenta o método nativo (browsers modernos) e faz fallback para FileReader
 * (necessário em WebViews antigas e em ambientes de teste como jsdom).
 */
function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  const anyBlob = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof anyBlob.arrayBuffer === "function") {
    return anyBlob.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(result);
      else reject(new Error("FileReader retornou tipo inesperado."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo."));
    reader.readAsArrayBuffer(blob);
  });
}
}

function indexOfSignature(bytes: Uint8Array): number {
  const [b0, b1, b2, b3, b4] = [0x25, 0x50, 0x44, 0x46, 0x2d]; // % P D F -
  const limit = bytes.length - 5;
  for (let i = 0; i <= limit; i++) {
    if (
      bytes[i] === b0 &&
      bytes[i + 1] === b1 &&
      bytes[i + 2] === b2 &&
      bytes[i + 3] === b3 &&
      bytes[i + 4] === b4
    ) {
      return i;
    }
  }
  return -1;
}
