/**
 * Centralized PDF.js worker configuration.
 * Importado uma única vez no bootstrap (main.tsx).
 *
 * Estratégia v3 (CDN-first):
 *   Tentativas anteriores com `?url` e `new URL(..., import.meta.url)` falharam
 *   em produção:
 *   - `?url` servia o asset com Content-Type errado e o pdf.js v4 rejeitava
 *     o module worker.
 *   - `new URL("pdfjs-dist/...", import.meta.url)` NÃO é transformado pelo
 *     Vite (só funciona com caminhos relativos `./` ou `../`), então em
 *     produção a URL resolvia para um caminho inexistente e o pdf.js caía
 *     no "fake worker" tentando `import('pdf.worker.mjs')` (bare specifier)
 *     e quebrando com "Failed to resolve module specifier 'pdf.worker.mjs'".
 *
 * Solução: usar a CDN diretamente como fonte primária. A mesma URL é
 * pré-cacheada pelo Service Worker (Workbox `pdfjs-worker-cache`), então
 * funciona offline e em qualquer dispositivo (mobile inclusive).
 * Fallbacks adicionais são gerenciados pelo PDFViewer.
 */
import { pdfjs } from 'react-pdf';

const CDN_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

pdfjs.GlobalWorkerOptions.workerSrc = CDN_WORKER_URL;
console.log('[PDF.js] workerSrc configurado (CDN):', CDN_WORKER_URL);

// Pré-aquece os CDNs (Workbox os captura no cache 'pdfjs-worker-cache')
// para servir como fallback offline.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then(() => {
      const version = pdfjs.version;
      const cdns = [
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`,
        `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`,
      ];
      cdns.forEach((url) => {
        fetch(url, { cache: 'force-cache', mode: 'no-cors' }).catch(() => {
          /* offline: ignora */
        });
      });
    })
    .catch(() => {
      /* SW indisponível: ignora */
    });
}

export { pdfjs };
