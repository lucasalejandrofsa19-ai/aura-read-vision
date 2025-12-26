/**
 * Centralized PDF.js worker configuration
 * This file should be imported once at app bootstrap (main.tsx)
 * to ensure consistent worker configuration across the entire app.
 */
import { pdfjs } from 'react-pdf';

// Use the bundled worker via unpkg CDN - this is the correct URL format
// for react-pdf that works with Vite
const workerUrl = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

console.log('[PDF.js] Worker configured:', workerUrl);

export { pdfjs };
