import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadWithProgress, UPLOAD_CANCELLED } from "./uploadWithProgress";

/**
 * XMLHttpRequest mock controlável — permite simular:
 *  - rede lenta com múltiplos eventos de progresso
 *  - stall (sem progresso após um tempo)
 *  - timeout duro (xhr.ontimeout)
 *  - conclusão com HTTP 200 / 409 / 401
 *  - abort externo (cancelamento manual)
 */
class MockXHR {
  static instances: MockXHR[] = [];
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = "";
  timeout = 0;
  aborted = false;
  sent = false;
  headers: Record<string, string> = {};

  constructor() {
    MockXHR.instances.push(this);
  }
  open() {}
  setRequestHeader(k: string, v: string) { this.headers[k] = v; }
  send() { this.sent = true; }
  abort() {
    if (this.aborted) return;
    this.aborted = true;
    this.onabort?.();
  }

  // Helpers de teste
  emitProgress(loaded: number, total: number) {
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded,
      total,
    } as ProgressEvent);
  }
  finish(status: number, body = "") {
    this.status = status;
    this.responseText = body;
    this.onload?.();
  }
  fireTimeout() { this.ontimeout?.(); }
}

const baseOpts = () => ({
  url: "https://example.test/storage/v1/object/pdfs/user/1-file.pdf",
  file: new Blob(["x".repeat(1024)], { type: "application/pdf" }),
  accessToken: "token",
  stallTimeoutMs: 45_000,
  stallCheckIntervalMs: 5_000,
  timeoutMs: 5 * 60_000,
});

describe("uploadWithProgress (E2E de rede lenta e stall)", () => {
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    vi.useFakeTimers();
    MockXHR.instances = [];
    originalXHR = globalThis.XMLHttpRequest;
    // @ts-expect-error - substituindo por mock
    globalThis.XMLHttpRequest = MockXHR;
  });

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXHR;
    vi.useRealTimers();
  });

  it("conclui com sucesso em rede lenta (progresso em blocos) e sai do loading", async () => {
    const progressFn = vi.fn();
    const promise = uploadWithProgress({ ...baseOpts(), onProgress: progressFn });
    const xhr = MockXHR.instances[0];

    // Rede lenta: progresso a cada 10s, sem estourar stall (45s)
    for (let i = 1; i <= 4; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      xhr.emitProgress(25 * i * 10, 1000); // 250, 500, 750, 1000 de 1000
    }
    xhr.finish(200);
    await expect(promise).resolves.toBeUndefined();

    expect(progressFn).toHaveBeenCalled();
    const last = progressFn.mock.calls.at(-1)![0];
    expect(last.pct).toBe(100);
  });

  it("dispara stall watchdog quando não há progresso por >45s (mensagem de conexão instável)", async () => {
    const promise = uploadWithProgress(baseOpts());
    // Anexa handler imediatamente para não emitir "unhandled rejection"
    // enquanto avançamos timers de forma assíncrona.
    const settled = promise.catch((e: Error) => e);
    const xhr = MockXHR.instances[0];

    await vi.advanceTimersByTimeAsync(1_000);
    xhr.emitProgress(50, 1000);

    await vi.advanceTimersByTimeAsync(50_000);

    const err = await settled;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/Conexão instável/i);
    expect(xhr.aborted).toBe(true);
  });


  it("dispara timeout duro (xhr.ontimeout) com mensagem apropriada", async () => {
    const promise = uploadWithProgress(baseOpts());
    const xhr = MockXHR.instances[0];

    xhr.emitProgress(10, 1000);
    // Simula o navegador acionando o timeout total do XHR
    xhr.fireTimeout();

    await expect(promise).rejects.toThrow(/Tempo esgotado no upload/i);
  });

  it("mapeia HTTP 409 para mensagem de conflito de nome", async () => {
    const promise = uploadWithProgress(baseOpts());
    const xhr = MockXHR.instances[0];
    xhr.finish(409, JSON.stringify({ message: "Duplicate" }));
    await expect(promise).rejects.toThrow(/Já existe um arquivo com esse nome/i);
  });

  it("mapeia HTTP 401/403 para sessão expirada", async () => {
    const p1 = uploadWithProgress(baseOpts());
    MockXHR.instances[0].finish(401);
    await expect(p1).rejects.toThrow(/Sessão expirada/i);

    const p2 = uploadWithProgress(baseOpts());
    MockXHR.instances[1].finish(403);
    await expect(p2).rejects.toThrow(/Sessão expirada/i);
  });

  it("permite cancelamento externo via registerXhr → erro __UPLOAD_CANCELLED__", async () => {
    let capturedXhr: XMLHttpRequest | null = null;
    const promise = uploadWithProgress({
      ...baseOpts(),
      registerXhr: (x) => { capturedXhr = x; },
    });
    expect(capturedXhr).not.toBeNull();
    capturedXhr!.abort();
    await expect(promise).rejects.toThrow(UPLOAD_CANCELLED);
  });

  it("não confunde stall com cancelamento: mensagem é 'Conexão instável', não __UPLOAD_CANCELLED__", async () => {
    const promise = uploadWithProgress(baseOpts());
    // Sem qualquer progresso → após 46s o watchdog aborta
    await vi.advanceTimersByTimeAsync(50_000);
    await expect(promise).rejects.toThrow(/Conexão instável/i);
    await expect(promise).rejects.not.toThrow(UPLOAD_CANCELLED);
  });
});
