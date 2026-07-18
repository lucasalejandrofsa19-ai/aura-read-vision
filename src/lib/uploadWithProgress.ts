/**
 * Upload de arquivo via XHR com progresso real, timeout duro e watchdog de stall.
 *
 * Preserva os comportamentos do UploadPDF:
 *  - timeout total (default 5 min) => "Tempo esgotado no upload…"
 *  - stall (sem progresso por >stallTimeoutMs, default 45s) => "Conexão instável…"
 *  - abort externo (cancelamento pelo usuário) => Error("__UPLOAD_CANCELLED__")
 *  - HTTP 409 => mensagem de conflito de nome
 *  - HTTP 401/403 => "Sessão expirada. Faça login novamente."
 *  - Outros erros => tenta ler body.message do JSON de resposta
 */

export const UPLOAD_CANCELLED = "__UPLOAD_CANCELLED__";

export interface UploadProgressInfo {
  loaded: number;
  total: number;
  pct: number;
  bytesPerSecond: number;
  etaSeconds: number;
  elapsedSeconds: number;
}

export interface UploadWithProgressOptions {
  url: string;
  file: Blob;
  accessToken: string;
  contentType?: string;
  upsert?: boolean;
  timeoutMs?: number;
  stallTimeoutMs?: number;
  stallCheckIntervalMs?: number;
  onProgress?: (info: UploadProgressInfo) => void;
  /** Recebe a instância XHR para permitir cancelamento externo. */
  registerXhr?: (xhr: XMLHttpRequest) => void;
}

export function uploadWithProgress(opts: UploadWithProgressOptions): Promise<void> {
  const {
    url,
    file,
    accessToken,
    contentType = "application/pdf",
    upsert = false,
    timeoutMs = 5 * 60 * 1000,
    stallTimeoutMs = 45_000,
    stallCheckIntervalMs = 5_000,
    onProgress,
    registerXhr,
  } = opts;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    registerXhr?.(xhr);
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", upsert ? "true" : "false");
    xhr.timeout = timeoutMs;

    const startTime = Date.now();
    let lastProgressAt = Date.now();
    let stalledOut = false;
    let stallWatchdog: ReturnType<typeof setInterval> | undefined;

    const clearWatchdog = () => {
      if (stallWatchdog !== undefined) {
        clearInterval(stallWatchdog);
        stallWatchdog = undefined;
      }
    };

    stallWatchdog = setInterval(() => {
      if (Date.now() - lastProgressAt > stallTimeoutMs) {
        stalledOut = true;
        clearWatchdog();
        try { xhr.abort(); } catch { /* ignore */ }
        reject(new Error("Conexão instável — upload pausou por muito tempo."));
      }
    }, stallCheckIntervalMs);

    xhr.upload.onprogress = (e: ProgressEvent) => {
      lastProgressAt = Date.now();
      if (!e.lengthComputable || !onProgress) return;
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const bps = elapsedSeconds > 0 ? e.loaded / elapsedSeconds : 0;
      const etaSeconds = bps > 0 ? (e.total - e.loaded) / bps : Infinity;
      onProgress({
        loaded: e.loaded,
        total: e.total,
        pct: Math.round((e.loaded / e.total) * 100),
        bytesPerSecond: bps,
        etaSeconds,
        elapsedSeconds,
      });
    };

    xhr.onload = () => {
      clearWatchdog();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let msg = `Falha no upload (HTTP ${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText);
        if (body?.message) msg = body.message;
      } catch { /* ignore */ }
      if (xhr.status === 409) msg = "Já existe um arquivo com esse nome — tente novamente.";
      if (xhr.status === 401 || xhr.status === 403) msg = "Sessão expirada. Faça login novamente.";
      reject(new Error(msg));
    };

    xhr.onerror = () => {
      clearWatchdog();
      reject(new Error("Conexão perdida durante o upload."));
    };
    xhr.ontimeout = () => {
      clearWatchdog();
      reject(new Error("Tempo esgotado no upload. Verifique sua conexão."));
    };
    xhr.onabort = () => {
      clearWatchdog();
      // Se o abort veio do watchdog, o reject de stall já ocorreu (promise settled).
      if (!stalledOut) reject(new Error(UPLOAD_CANCELLED));
    };

    xhr.send(file);
  });
}
