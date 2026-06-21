/**
 * Centralized PDF.js worker configuration.
 *
 * Estratégia v4 (LOCAL-first):
 *   O worker é servido do mesmo origin (`/pdfjs/pdf.worker.min.mjs`),
 *   copiado de `node_modules/pdfjs-dist/build/` para `public/pdfjs/`.
 *   Isso elimina dependência de CDNs externos (jsdelivr/unpkg), que
 *   estavam falhando intermitentemente com "Failed to fetch dynamically
 *   imported module" e quebrando o leitor.
 *
 *   CDNs continuam disponíveis como fallback no PDFViewer.
 */
import { pdfjs } from 'react-pdf';

const LOCAL_WORKER_URL = '/pdfjs/pdf.worker.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = LOCAL_WORKER_URL;
console.log('[PDF.js] workerSrc configurado (LOCAL):', LOCAL_WORKER_URL);

export { pdfjs };
