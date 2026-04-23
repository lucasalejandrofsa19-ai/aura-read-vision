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

export { pdfjs };
