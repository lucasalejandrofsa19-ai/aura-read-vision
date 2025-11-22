import { useEffect, useRef } from "react";
import { pdfjs } from "react-pdf";

interface UsePDFPrefetchOptions {
  fileUrl: string;
  currentPage: number;
  numPages: number;
  prefetchCount?: number; // Quantas páginas prefetch (padrão: 3)
}

export const usePDFPrefetch = ({
  fileUrl,
  currentPage,
  numPages,
  prefetchCount = 3,
}: UsePDFPrefetchOptions) => {
  const cacheRef = useRef<Map<number, any>>(new Map());
  const prefetchingRef = useRef<Set<number>>(new Set());
  const pdfDocRef = useRef<any>(null);

  // Limpar cache de páginas antigas (manter apenas páginas próximas)
  const cleanupCache = (currentPage: number, keepRange: number = 5) => {
    const cache = cacheRef.current;
    const pagesToKeep = new Set<number>();

    // Manter páginas no range: [currentPage - keepRange, currentPage + keepRange]
    for (let i = Math.max(1, currentPage - keepRange); i <= Math.min(numPages, currentPage + keepRange); i++) {
      pagesToKeep.add(i);
    }

    // Remover páginas fora do range
    Array.from(cache.keys()).forEach(pageNum => {
      if (!pagesToKeep.has(pageNum)) {
        cache.delete(pageNum);
      }
    });
  };

  // Prefetch de uma página específica
  const prefetchPage = async (pageNum: number) => {
    if (pageNum < 1 || pageNum > numPages) return;
    if (cacheRef.current.has(pageNum)) return;
    if (prefetchingRef.current.has(pageNum)) return;

    prefetchingRef.current.add(pageNum);

    try {
      // Usar requestIdleCallback para não bloquear o thread principal
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(async () => {
          await loadPageIntoCache(pageNum);
        }, { timeout: 2000 });
      } else {
        // Fallback para setTimeout
        setTimeout(async () => {
          await loadPageIntoCache(pageNum);
        }, 100);
      }
    } catch (error) {
      console.error(`Error prefetching page ${pageNum}:`, error);
      prefetchingRef.current.delete(pageNum);
    }
  };

  const loadPageIntoCache = async (pageNum: number) => {
    try {
      if (!pdfDocRef.current) {
        const loadingTask = pdfjs.getDocument(fileUrl);
        pdfDocRef.current = await loadingTask.promise;
      }

      const page = await pdfDocRef.current.getPage(pageNum);
      
      // Renderizar a página em um canvas offscreen para cache
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        
        // Armazenar no cache
        cacheRef.current.set(pageNum, {
          page,
          canvas,
          viewport,
          timestamp: Date.now(),
        });

        console.log(`[PREFETCH] Page ${pageNum} loaded into cache`);
      }
    } catch (error) {
      console.error(`Error loading page ${pageNum} into cache:`, error);
    } finally {
      prefetchingRef.current.delete(pageNum);
    }
  };

  // Efeito para prefetch de páginas próximas quando currentPage muda
  useEffect(() => {
    if (!fileUrl || numPages === 0) return;

    // Limpar cache de páginas antigas
    cleanupCache(currentPage);

    // Prefetch das próximas páginas
    const pagesToPrefetch: number[] = [];
    for (let i = 1; i <= prefetchCount; i++) {
      const nextPage = currentPage + i;
      if (nextPage <= numPages) {
        pagesToPrefetch.push(nextPage);
      }
    }

    // Prefetch das páginas anteriores também (menos prioritário)
    const prevPage = currentPage - 1;
    if (prevPage >= 1) {
      pagesToPrefetch.push(prevPage);
    }

    // Executar prefetch
    pagesToPrefetch.forEach(pageNum => {
      prefetchPage(pageNum);
    });

  }, [currentPage, fileUrl, numPages, prefetchCount]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      cacheRef.current.clear();
      prefetchingRef.current.clear();
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, []);

  return {
    cache: cacheRef.current,
    isPageCached: (pageNum: number) => cacheRef.current.has(pageNum),
    getCachedPage: (pageNum: number) => cacheRef.current.get(pageNum),
  };
};
