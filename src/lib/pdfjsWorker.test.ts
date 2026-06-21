import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes da configuração e prewarm do worker pdf.js (v5 LOCAL-first).
 *
 * Estratégia:
 *  - workerSrc é setado IMEDIATAMENTE para o worker LOCAL (/pdfjs/...).
 *  - Em mobile/PWA, ensurePdfWorkerReady() faz pré-fetch do LOCAL para
 *    forçar o Workbox a popular o cache 'pdfjs-worker-local-cache'.
 *  - Se o LOCAL falhar, há fallback para CDNs.
 */

const mockFetch = vi.fn((..._args: unknown[]) =>
  Promise.resolve(new Response("", { status: 200 })),
);

vi.mock("react-pdf", () => ({
  pdfjs: {
    version: "4.8.69",
    GlobalWorkerOptions: { workerSrc: "" },
  },
}));

describe("pdfjsWorker (LOCAL-first)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockClear();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({} as ServiceWorkerRegistration) },
    });
    // Força mobile UA para acionar prewarm automático
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) Mobile/15E148",
    });
  });

  it("configura workerSrc para o caminho LOCAL imediatamente no boot", async () => {
    const mod = await import("@/lib/pdfjsWorker");
    expect(mod.pdfjs.GlobalWorkerOptions.workerSrc).toBe("/pdfjs/pdf.worker.min.mjs");
  });

  it("ensurePdfWorkerReady tenta o LOCAL primeiro e o resolve quando OK", async () => {
    const mod = await import("@/lib/pdfjsWorker");
    const used = await mod.ensurePdfWorkerReady();
    expect(used).toBe("/pdfjs/pdf.worker.min.mjs");

    const urls = mockFetch.mock.calls.map((c) => c[0]);
    expect(urls[0]).toBe("/pdfjs/pdf.worker.min.mjs");
  });

  it("faz fallback para CDN se o LOCAL falhar", async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    const mod = await import("@/lib/pdfjsWorker");
    const used = await mod.ensurePdfWorkerReady();
    expect(used).toContain("cdn.jsdelivr.net");
  });

  it("não lança quando todos os fetches falham", async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error("offline")));
    const mod = await import("@/lib/pdfjsWorker");
    await expect(mod.ensurePdfWorkerReady()).resolves.toBe("/pdfjs/pdf.worker.min.mjs");
  });
});
