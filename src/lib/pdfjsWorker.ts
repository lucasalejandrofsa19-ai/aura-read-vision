/**
 * Centralized PDF.js worker configuration
 * Importado uma única vez no bootstrap (main.tsx).
 *
 * Usa o import `?worker` do Vite para instanciar o Worker como módulo já
 * resolvido pelo bundler, expondo-o via `workerPort`. Isso evita a cadeia
 * de fallback do pdf.js v4 que termina em
 * `import('pdf.worker.mjs')` (especificador bare) — origem do erro
 * "Failed to resolve module specifier 'pdf.worker.mjs'".
 */
import { pdfjs } from 'react-pdf';
// Vite cria um Worker module a partir desse arquivo
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

try {
  // Preferencial: workerPort (mais robusto que workerSrc)
  (pdfjs.GlobalWorkerOptions as any).workerPort = new PdfWorker();
  console.log('[PDF.js] workerPort configurado via ?worker bundler');
} catch (e) {
  console.error('[PDF.js] Falha ao instanciar Worker bundled, caindo para CDN', e);
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export { pdfjs };
