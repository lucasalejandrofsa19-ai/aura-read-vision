/**
 * Centralized PDF.js worker configuration.
 * Importado uma única vez no bootstrap (main.tsx).
 *
 * Estratégia v2: usar `new URL(..., import.meta.url)` em vez de `?url`.
 * O `?url` produz um asset que, em produção, é servido com Content-Type
 * `application/javascript`. O pdf.js v4 cria o Worker com `{ type: 'module' }`
 * e em alguns navegadores a checagem de MIME para module workers exige
 * `text/javascript` exato; quando falha, o pdf.js cai no "fake worker" que
 * tenta `import('pdf.worker.mjs')` (bare specifier) e quebra com:
 *   "Failed to resolve module specifier 'pdf.worker.mjs'".
 *
 * `new URL(specifier, import.meta.url)` é entendido pelo Vite, gera o asset
 * com hash do MESMO arquivo, e devolve uma URL absoluta confiável que o
 * navegador trata como worker module sem o glitch acima.
 *
 * Fallback CDN é gerenciado pelo PDFViewer caso o worker bundled falhe.
 */
import { pdfjs } from 'react-pdf';

const workerUrl = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
console.log('[PDF.js] workerSrc configurado:', workerUrl);

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
