/**
 * Centralized PDF.js worker configuration.
 *
 * Estratégia v5 (LOCAL-first + warm-up para Mobile & PWA):
 *   - workerSrc sempre apontando para `/pdfjs/pdf.worker.min.mjs` (same-origin).
 *   - Função `ensurePdfWorkerReady()` específica para mobile/PWA que:
 *       1) Detecta ambiente (mobile UA ou display-mode standalone).
 *       2) Aguarda o Service Worker estar ativo (quando existir).
 *       3) Faz pré-fetch do worker para forçar cache (CacheFirst do Workbox).
 *       4) Faz fallback para CDN somente se o LOCAL falhar.
 */
import { pdfjs } from 'react-pdf';

const LOCAL_WORKER_URL = '/pdfjs/pdf.worker.min.mjs';
const CDN_FALLBACKS = [
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
];

// Bootstrap síncrono — qualquer chamada a getDocument() já tem worker definido
pdfjs.GlobalWorkerOptions.workerSrc = LOCAL_WORKER_URL;
console.log('[PDF.js] workerSrc bootstrap (LOCAL):', LOCAL_WORKER_URL);

const isMobile = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};

const isPWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
};

let readyPromise: Promise<string> | null = null;

/**
 * Garante que o worker do PDF.js esteja disponível e cacheado.
 * Específico para mobile/PWA: aguarda SW + força pré-fetch + fallback p/ CDN.
 * Idempotente: chamadas paralelas retornam o mesmo Promise.
 */
export const ensurePdfWorkerReady = async (): Promise<string> => {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    const mobile = isMobile();
    const pwa = isPWA();
    console.log('[PDF.js] ensurePdfWorkerReady →', { mobile, pwa });

    // Aguarda SW estar pronto (no PWA é crítico — senão o fetch pode bypassar cache)
    if (pwa && 'serviceWorker' in navigator) {
      try {
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch {
        /* ignora */
      }
    }

    const candidates = [LOCAL_WORKER_URL, ...CDN_FALLBACKS];

    for (const url of candidates) {
      try {
        const res = await fetch(url, { method: 'GET', cache: 'force-cache' });
        if (res.ok) {
          pdfjs.GlobalWorkerOptions.workerSrc = url;
          console.log('[PDF.js] worker pronto e cacheado:', url);
          return url;
        }
        console.warn('[PDF.js] worker HTTP', res.status, 'em', url);
      } catch (err) {
        console.warn('[PDF.js] falha no worker', url, err);
      }
    }

    // Mantém o LOCAL como último recurso (mesmo se fetch falhou, pdf.js pode
    // tentar diretamente e o SW pode servir do cache em outra tentativa).
    pdfjs.GlobalWorkerOptions.workerSrc = LOCAL_WORKER_URL;
    console.error('[PDF.js] Nenhum worker respondeu OK — usando LOCAL como último recurso');
    return LOCAL_WORKER_URL;
  })();

  return readyPromise;
};

// Pré-aquecimento automático em mobile/PWA assim que o módulo carrega.
// Em desktop, o LOCAL síncrono já basta.
if (typeof window !== 'undefined' && (isMobile() || isPWA())) {
  // Não bloqueia o boot — roda em background
  ensurePdfWorkerReady().catch(() => {
    /* ignora — fallback já configurado */
  });
}

export { pdfjs };
