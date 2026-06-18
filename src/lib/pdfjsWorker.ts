/**
 * Centralized PDF.js worker configuration
 * This file should be imported once at app bootstrap (main.tsx)
 * to ensure consistent worker configuration across the entire app.
 *
 * Uses Vite's `?url` import to bundle the worker locally instead of
 * fetching from a CDN. This is critical for:
 *  - Mobile reliability (Android Chrome often fails on cross-origin worker loads)
 *  - PWA / offline mode (worker must be available without network)
 *  - Avoiding version mismatches between react-pdf and the worker
 */
import { pdfjs } from 'react-pdf';
// Vite serves this as a hashed asset URL, bundled with the app
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

console.log('[PDF.js] Worker configured (bundled):', workerUrl);

// Pré-aquece os workers de CDN (jsDelivr + unpkg) para fallback offline.
// O Service Worker (workbox) intercepta e armazena em 'pdfjs-worker-cache'.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const prewarm = () => {
    const urls = [
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
      `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
    ];
    urls.forEach((u) =>
      fetch(u, { mode: 'no-cors', cache: 'force-cache' }).catch((e) =>
        console.warn('[PDF.js] Pré-aquecimento falhou para', u, e),
      ),
    );
  };
  // Aguarda o SW ficar pronto antes de pré-aquecer
  navigator.serviceWorker.ready
    .then(prewarm)
    .catch(() => prewarm()); // tenta mesmo sem SW (ainda popula o HTTP cache)
}

export { pdfjs };
