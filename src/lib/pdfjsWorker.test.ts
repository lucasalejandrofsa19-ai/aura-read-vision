import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes do pré-aquecimento do worker pdf.js.
 *
 * Limitação: jsdom não executa Service Workers reais. Não há como testar
 * fim-a-fim "ficar offline e ainda servir o worker" sem Playwright + browser
 * real com SW habilitado. Aqui validamos a parte que controlamos no app:
 *  1) Após `navigator.serviceWorker.ready`, fazemos `fetch` nos CDNs do worker.
 *  2) Os fetches usam `cache: 'force-cache'` e `mode: 'no-cors'`
 *     (necessário para o Workbox interceptar e popular o cache 'pdfjs-worker-cache').
 *  3) Erros de fetch não derrubam o app.
 */

const mockFetch = vi.fn((..._args: unknown[]) =>
  Promise.resolve(new Response("", { status: 200 })),
);

// Mock react-pdf antes do import dinâmico
vi.mock("react-pdf", () => ({
  pdfjs: {
    version: "4.8.69",
    GlobalWorkerOptions: { workerSrc: "" },
  },
}));

// Mock do `?url` do Vite
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "/assets/pdf.worker.min.mjs",
}));

describe("pdfjsWorker prewarm", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockClear();
    // @ts-expect-error global override em jsdom
    global.fetch = mockFetch;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({} as ServiceWorkerRegistration) },
    });
  });

  it("configura workerSrc bundled e pré-aquece os CDNs após o SW ficar pronto", async () => {
    const mod = await import("@/lib/pdfjsWorker");
    expect(mod.pdfjs.GlobalWorkerOptions.workerSrc).toBe(
      "/assets/pdf.worker.min.mjs",
    );

    // aguarda microtasks do `navigator.serviceWorker.ready.then(prewarm)`
    await new Promise((r) => setTimeout(r, 0));

    const urls = mockFetch.mock.calls.map((c) => c[0]);
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69"),
        expect.stringContaining("unpkg.com/pdfjs-dist@4.8.69"),
      ]),
    );

    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(opts.cache).toBe("force-cache");
    expect(opts.mode).toBe("no-cors");
  });

  it("não lança quando o fetch falha", async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    await expect(import("@/lib/pdfjsWorker")).resolves.toBeDefined();
    await new Promise((r) => setTimeout(r, 0));
    // se chegou aqui sem unhandled rejection, passa
    expect(true).toBe(true);
  });
});
