/**
 * Centralized PDF.js worker configuration.
 * Importado uma única vez no bootstrap (main.tsx).
 *
 * Estratégia: usar `?url` do Vite para que o bundler emita o arquivo
 * `pdf.worker.min.mjs` como asset estático servido pelo MESMO domínio.
 * Isso evita:
 *  - o fallback de bare specifier `pdf.worker.mjs` do pdf.js v4
 *    ("Failed to resolve module specifier 'pdf.worker.mjs'")
 *  - bloqueios de CDN externo
 *  - problemas com `?worker` (o worker do pdf.js faz dynamic import interno
 *    que quebra quando empacotado como module worker do Vite em produção).
 */
import { pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
console.log('[PDF.js] workerSrc configurado:', workerUrl);

export { pdfjs };
