import { test, expect } from "@playwright/test";

/**
 * E2E: verifica que o Service Worker pré-aquece o pdf.js worker
 * e o serve a partir do cache quando o usuário fica offline.
 *
 * Pré-requisitos:
 *  - App publicado/served em produção (SW só registra fora do preview).
 *  - Variável BASE_URL apontando para a URL publicada.
 *
 * Rodar:
 *   BASE_URL=https://aura-read.lovable.app npx playwright test e2e/pdfWorkerOffline.spec.ts
 */

const BASE_URL = process.env.BASE_URL ?? "https://aura-read.lovable.app";

// URLs CDN usadas em src/lib/pdfjsWorker.ts (devem coincidir)
const WORKER_URL_PATTERNS = [
  /cdn\.jsdelivr\.net\/npm\/pdfjs-dist@.+\/build\/pdf\.worker\.mjs/,
  /unpkg\.com\/pdfjs-dist@.+\/build\/pdf\.worker\.mjs/,
];

test.describe("Service Worker — pdf.js worker offline", () => {
  test("pré-aquece o worker e serve do cache quando offline", async ({
    page,
    context,
  }) => {
    // 1. Primeira visita online: registra SW e dispara prewarm
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // Aguarda o SW assumir controle
    await page.waitForFunction(
      () => navigator.serviceWorker?.controller !== null,
      null,
      { timeout: 15_000 },
    );

    // Aguarda o prewarm popular o cache do Workbox
    await page.waitForFunction(
      async (patterns) => {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          const urls = keys.map((r) => r.url);
          if (patterns.every((p) => urls.some((u) => new RegExp(p).test(u)))) {
            return true;
          }
          // basta um match (CacheFirst pode armazenar só o primeiro requisitado)
          if (patterns.some((p) => urls.some((u) => new RegExp(p).test(u)))) {
            return true;
          }
        }
        return false;
      },
      WORKER_URL_PATTERNS.map((r) => r.source),
      { timeout: 20_000 },
    );

    // 2. Fica offline
    await context.setOffline(true);

    // 3. Tenta buscar o worker direto via fetch() — deve vir do SW/cache
    const workerStatuses = await page.evaluate(async (patterns) => {
      const results: { url: string; ok: boolean; status: number }[] = [];
      const cacheNames = await caches.keys();
      const cachedUrls = new Set<string>();
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        for (const r of keys) cachedUrls.add(r.url);
      }
      const targets = Array.from(cachedUrls).filter((u) =>
        patterns.some((p) => new RegExp(p).test(u)),
      );
      for (const url of targets) {
        try {
          const res = await fetch(url, { cache: "force-cache" });
          results.push({ url, ok: res.ok || res.status === 0, status: res.status });
        } catch (e) {
          results.push({ url, ok: false, status: -1 });
        }
      }
      return results;
    }, WORKER_URL_PATTERNS.map((r) => r.source));

    expect(workerStatuses.length).toBeGreaterThan(0);
    for (const r of workerStatuses) {
      expect(r.ok, `worker ${r.url} deveria ser servido offline`).toBe(true);
    }

    await context.setOffline(false);
  });
});
