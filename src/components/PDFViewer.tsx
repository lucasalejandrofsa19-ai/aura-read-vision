import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, RefreshCw, ArrowLeft, AlertTriangle, BookOpen, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PDFSearchBar } from "@/components/PDFSearchBar";
import { usePDFPrefetch } from "@/hooks/usePDFPrefetch";
import { HighlightCanvas } from "@/components/HighlightCanvas";
import { captureError } from "@/lib/sentry";
// Type for PDF text items - using any to avoid deep import issues
interface PDFTextItem {
  str?: string;
  hasEOL?: boolean;
  dir?: string;
  width?: number;
  height?: number;
  transform?: number[];
  fontName?: string;
}
import "react-pdf/dist/Page/TextLayer.css";
// Bootstrap centralizado: garante worker LOCAL e expõe ensurePdfWorkerReady()
// dedicado a mobile/PWA (aguarda Service Worker + pré-fetch + fallback CDN).
import { ensurePdfWorkerReady } from "@/lib/pdfjsWorker";

if (!pdfjs.GlobalWorkerOptions.workerSrc || pdfjs.GlobalWorkerOptions.workerSrc === "pdf.worker.mjs") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
}


interface PDFViewerProps {
  fileUrl: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onTextSelect?: (text: string) => void;
  bookmarkIndicator?: React.ReactNode;
  externalScale?: number;
  onScaleChange?: (scale: number) => void;
  highlights?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  onHighlightDrawn?: (coords: { x: number; y: number; width: number; height: number; text: string; color: string }) => Promise<{ id?: string } | undefined | void> | void;
  isDrawingMode?: boolean;
  highlightColor?: string;
  penThickness?: number;
  spokenText?: string;
  /** Renova a URL assinada quando expirar. Retorna a nova URL ou null. */
  onRenewUrl?: () => Promise<string | null>;
  /** Preferência persistida do usuário: 'full' = leitor completo, 'native' = iframe nativo */
  preferredReaderMode?: 'full' | 'native';
  /** Callback chamado quando o usuário alterna manualmente o modo de leitor */
  onReaderModeChange?: (mode: 'full' | 'native') => void;
}

type LikelyCause = {
  title: string;
  hint: string;
};

const classifyPdfError = (
  error: Error | null,
  fileUrl: unknown
): LikelyCause => {
  const msg = (error?.message || "").toLowerCase();
  const name = (error?.name || "").toLowerCase();
  const url = typeof fileUrl === "string" ? fileUrl : "";

  // URL assinada do Supabase Storage expirada
  if (url.includes("token=") && /expired|signature|403|forbidden/.test(msg)) {
    return {
      title: "URL expirada",
      hint: "O link assinado do arquivo expirou. Recarregue a página para gerar um novo.",
    };
  }
  if (/cors|cross-origin|blocked by cors/.test(msg)) {
    return {
      title: "Bloqueio de CORS",
      hint: "O servidor do arquivo não permite acesso desta origem.",
    };
  }
  if (/mime|unexpectedresponseexception|invalid pdf|invalidpdfexception|missing pdf/.test(msg) || name.includes("invalidpdf")) {
    return {
      title: "Arquivo inválido ou MIME incorreto",
      hint: "O conteúdo retornado não é um PDF válido (verifique Content-Type e integridade).",
    };
  }
  if (/404|not.?found/.test(msg)) {
    return {
      title: "Arquivo não encontrado (404)",
      hint: "O PDF foi removido do storage ou o caminho está incorreto.",
    };
  }
  if (/401|403|unauthor|forbidden/.test(msg)) {
    return {
      title: "Acesso negado",
      hint: "Sem permissão para baixar o arquivo (verifique RLS/policies do bucket).",
    };
  }
  if (/network|failed to fetch|load failed|timeout|aborted/.test(msg)) {
    return {
      title: "Falha de rede",
      hint: "Conexão instável ou servidor indisponível. Tente novamente.",
    };
  }
  if (/password/.test(msg)) {
    return {
      title: "PDF protegido por senha",
      hint: "Este PDF requer senha para ser aberto.",
    };
  }
  if (/worker|fake worker|module specifier|pdf\.worker/.test(msg)) {
    return {
      title: "Worker do PDF.js não carregou",
      hint: "Recarregue a página (Ctrl/Cmd+Shift+R) para atualizar o worker bundled.",
    };
  }
  return {
    title: "Causa desconhecida",
    hint: "Não foi possível identificar a origem do erro automaticamente.",
  };
};

export const PDFViewer = ({ 
  fileUrl, 
  initialPage = 1, 
  onPageChange,
  onTextSelect,
  bookmarkIndicator,
  externalScale,
  onScaleChange,
  highlights = [],
  onHighlightDrawn,
  isDrawingMode = false,
  highlightColor = "#fef08a",
  penThickness = 20,
  spokenText = '',
  onRenewUrl,
  preferredReaderMode,
  onReaderModeChange,
}: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(externalScale || 1.0);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelay, setRetryDelay] = useState(0); // segundos restantes
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [compatibilityMode, setCompatibilityMode] = useState(false);
  // Quando o compat foi ativado por falha (worker/HEAD/sessão prévia), trava o
  // estado para não ser revertido por refetch de perfil/preferência.
  const autoCompatLockedRef = useRef(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [currentWorkerSrc, setCurrentWorkerSrc] = useState<string>(
    typeof pdfjs.GlobalWorkerOptions.workerSrc === "string"
      ? pdfjs.GlobalWorkerOptions.workerSrc
      : "(unset)",
  );
  const workerFallbackTriedRef = useRef(false);
  const MAX_RETRIES = 4;

  // ───────────────────────── Debug visual / telemetria ─────────────────────────
  // Ativa quando: ?pdfdebug=1 na URL ou localStorage.PDF_DEBUG === '1'.
  const debugEnabled = (() => {
    if (typeof window === "undefined") return false;
    try {
      if (new URLSearchParams(window.location.search).get("pdfdebug") === "1") return true;
      if (window.localStorage?.getItem("PDF_DEBUG") === "1") return true;
    } catch {
      /* ignora */
    }
    return false;
  })();
  type DebugEvent = { ts: string; level: "info" | "warn" | "error"; msg: string };
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const pdfDebug = useCallback(
    (level: "info" | "warn" | "error", msg: string, extra?: unknown) => {
      const line = `[PDFViewer] ${msg}`;
      // Console sempre — útil mesmo sem o overlay visual
      // eslint-disable-next-line no-console
      (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(
        line,
        extra ?? "",
      );
      if (!debugEnabled) return;
      setDebugEvents((prev) => {
        const next = [
          ...prev,
          { ts: new Date().toLocaleTimeString(), level, msg },
        ];
        return next.slice(-30); // mantém últimos 30
      });
    },
    [debugEnabled],
  );

  // Lista ordenada de workerSrc para tentar em sequência ao detectar falha de worker
  // Local first (mesmo origin, sem dependência de CDN), depois CDNs como fallback
  const workerFallbacks = [
    "/pdfjs/pdf.worker.min.mjs",
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
  ];
  const workerFallbackIndexRef = useRef(0);

  const tryWorkerFallback = useCallback((): boolean => {
    if (workerFallbackIndexRef.current >= workerFallbacks.length) return false;
    const nextSrc = workerFallbacks[workerFallbackIndexRef.current++];
    pdfDebug("warn", `Trocando worker → ${nextSrc} (fallback #${workerFallbackIndexRef.current})`);
    pdfjs.GlobalWorkerOptions.workerSrc = nextSrc;
    setCurrentWorkerSrc(nextSrc);
    workerFallbackTriedRef.current = true;
    setLoadError(null);
    setLoadAttempt((n) => n + 1);
    return true;
  }, [pdfDebug]);

  const lockAutoCompat = useCallback(
    (reason: string) => {
      autoCompatLockedRef.current = true;
      setLockReason(reason);
      pdfDebug("warn", `Auto-fallback TRAVADO: ${reason}`);
    },
    [pdfDebug],
  );

  const enterCompatibilityMode = useCallback(() => {
    pdfDebug("info", "Usuário escolheu modo nativo (iframe).");
    autoCompatLockedRef.current = false;
    setLockReason(null);
    setCompatibilityMode(true);
    setLoadError(null);
    onReaderModeChange?.('native');
  }, [onReaderModeChange, pdfDebug]);

  const exitCompatibilityMode = useCallback(() => {
    pdfDebug("info", "Usuário voltou ao leitor completo.");
    workerFallbackIndexRef.current = 0;
    workerFallbackTriedRef.current = false;
    autoCompatLockedRef.current = false;
    setLockReason(null);
    setCompatibilityMode(false);
    setLoadError(null);
    setLoadAttempt((n) => n + 1);
    try {
      const key = typeof fileUrl === "string" ? fileUrl.split("?")[0] : "";
      if (key) sessionStorage.removeItem(`pdfviewer:failed:${key}`);
    } catch {
      /* ignora */
    }
    onReaderModeChange?.('full');
  }, [fileUrl, onReaderModeChange, pdfDebug]);


  // Reseta tentativas APENAS quando o arquivo muda.
  useEffect(() => {
    setRetryCount(0);
    setRetryDelay(0);
    setLoadError(null);
    const shouldUseNative = preferredReaderMode === 'native';
    setCompatibilityMode(shouldUseNative);
    autoCompatLockedRef.current = false;
    setLockReason(null);
    workerFallbackIndexRef.current = 0;
    workerFallbackTriedRef.current = false;
    pdfDebug(
      "info",
      `Novo arquivo carregado. Modo inicial = ${shouldUseNative ? "nativo (preferência)" : "completo"}.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  // Detecção preventiva: se o PDF é grande (>25MB) ou já falhou antes nesta
  // sessão, abre direto no modo de compatibilidade para evitar loops de
  // tentativas e travamento em dispositivos com pouca memória (mobile).
  const LARGE_PDF_THRESHOLD_BYTES = 25 * 1024 * 1024; // 25 MB
  const fileKey = typeof fileUrl === "string" ? fileUrl.split("?")[0] : "";

  useEffect(() => {
    if (typeof fileUrl !== "string" || !fileUrl) return;

    // 1) Falha prévia conhecida nesta sessão? abre direto em compat (travado).
    try {
      const failedKey = `pdfviewer:failed:${fileKey}`;
      if (sessionStorage.getItem(failedKey) === "1") {
        lockAutoCompat("Arquivo marcado como problemático em sessão anterior");
        setCompatibilityMode(true);
        return;
      }
    } catch {
      /* sessionStorage indisponível: ignora */
    }

    // 2) HEAD para detectar arquivos grandes. Falhas (CORS/HEAD bloqueado)
    // são silenciosamente ignoradas — o leitor normal tenta carregar.
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(fileUrl, { method: "HEAD", signal: ctrl.signal });
        const len = Number(res.headers.get("content-length") || "0");
        if (len > 0 && len > LARGE_PDF_THRESHOLD_BYTES) {
          lockAutoCompat(`PDF grande (${(len / 1024 / 1024).toFixed(1)} MB > 25 MB)`);
          setCompatibilityMode(true);
        }
      } catch {
        /* HEAD bloqueado/sem CORS: ignora, deixa o leitor padrão tentar */
      }
    })();

    return () => ctrl.abort();
  }, [fileUrl, fileKey]);

  // Marca o arquivo como problemático APENAS quando o compat foi ativado
  // automaticamente por falha (não quando o usuário escolheu nativo manualmente).
  useEffect(() => {
    if (!compatibilityMode || !fileKey) return;
    if (!autoCompatLockedRef.current) return;
    try {
      sessionStorage.setItem(`pdfviewer:failed:${fileKey}`, "1");
    } catch {
      /* ignora */
    }
  }, [compatibilityMode, fileKey]);




  const handleRetry = useCallback(async () => {
    if (retryCount >= MAX_RETRIES || retryDelay > 0) return;
    const next = retryCount + 1;
    const delayMs = Math.min(1000 * 2 ** retryCount, 8000);
    const delaySec = Math.ceil(delayMs / 1000);
    setRetryCount(next);
    setRetryDelay(delaySec);
    const tick = setInterval(() => {
      setRetryDelay((s) => {
        if (s <= 1) {
          clearInterval(tick);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    // Se a causa provável é URL expirada, tenta renovar antes do reload
    const cause = classifyPdfError(loadError, fileUrl);
    if (cause.title === "URL expirada" && onRenewUrl) {
      try {
        const newUrl = await onRenewUrl();
        if (newUrl) {
          console.info("[PDFViewer] URL assinada renovada com sucesso.");
        } else {
          console.warn("[PDFViewer] Renovação de URL retornou vazio.");
        }
      } catch (e) {
        console.error("[PDFViewer] Erro ao renovar URL assinada:", e);
      }
    }

    setTimeout(() => {
      setLoadError(null);
      setLoadAttempt((n) => n + 1);
    }, delayMs);
  }, [retryCount, retryDelay, loadError, fileUrl, onRenewUrl]);
  
  // Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [pageTexts, setPageTexts] = useState<Map<number, string>>(new Map());
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [currentPageTextItems, setCurrentPageTextItems] = useState<any[]>([]);
  // Cache the loaded pdfDoc proxy so we don't re-download the entire PDF
  // on every highlight or search (major OOM cause on Android Chrome).
  const pdfDocRef = useRef<any>(null);

  // Prefetch hook para carregar próximas páginas
  const { isPageCached, cache } = usePDFPrefetch({
    fileUrl,
    currentPage: pageNumber,
    numPages,
    prefetchCount: 3,
  });

  useEffect(() => {
    if (externalScale !== undefined) {
      setScale(externalScale);
      setAutoFit(false);
    }
  }, [externalScale]);

  useEffect(() => {
    setPageNumber(initialPage);
  }, [initialPage]);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      
      if (selectedText && selectedText.length > 0) {
        onTextSelect?.(selectedText);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [onTextSelect]);

  const onDocumentLoadSuccess = (pdfDoc: any) => {
    setNumPages(pdfDoc.numPages);
    setPageTexts(new Map());
    setLoadError(null);
    pdfDocRef.current = pdfDoc;
  };

  const extractTextFromPage = async (pageNum: number, pdfDoc: any) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const raw = textContent.items
        .map((item: PDFTextItem) => ('str' in item ? item.str : ''))
        .join(' ');
      // Normaliza: minúsculas, sem acentos, espaços colapsados.
      // Permite busca por frase mesmo cruzando quebras de linha/itens.
      const text = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return text;
    } catch (error) {
      console.error(`Error extracting text from page ${pageNum}:`, error);
      return '';
    }
  };

  const extractTextFromCoordinates = async (coords: { x: number; y: number; width: number; height: number }) => {
    try {
      // Reuse the cached pdfDoc loaded by react-pdf instead of re-downloading
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc) {
        console.warn("[extractText] PDF document not yet loaded");
        return '';
      }
      const page = await pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      // Use scale 1 viewport para coordenadas normalizadas
      const viewport = page.getViewport({ scale: 1 });
      
      console.log("[extractText] Coords recebidas:", coords);
      console.log("[extractText] Viewport height:", viewport.height);
      
      const extractedTexts: string[] = [];
      
      textContent.items.forEach((item: any) => {
        if ('str' in item && 'transform' in item) {
          const [scaleX, , , scaleY, itemX, itemY] = item.transform;
          const itemHeight = Math.abs(scaleY) || 12;
          const itemWidth = item.width * Math.abs(scaleX) || 0;
          
          // Converter coordenadas PDF (origem bottom-left) para canvas (origem top-left)
          const canvasItemY = viewport.height - itemY;
          
          // Verificar overlap com área destacada (tolerância aumentada)
          const tolerance = 20;
          const itemRight = itemX + itemWidth;
          const itemTop = canvasItemY - itemHeight;
          const itemBottom = canvasItemY;
          
          const highlightRight = coords.x + coords.width;
          const highlightBottom = coords.y + coords.height;
          
          // Checar se há interseção
          const xOverlap = itemX < highlightRight + tolerance && itemRight > coords.x - tolerance;
          const yOverlap = itemTop < highlightBottom + tolerance && itemBottom > coords.y - tolerance;
          
          if (xOverlap && yOverlap) {
            console.log("[extractText] Texto encontrado:", item.str, {
              itemX,
              itemY: canvasItemY,
              itemWidth,
              itemHeight,
              highlightCoords: coords
            });
            extractedTexts.push(item.str);
          }
        }
      });
      
      const result = extractedTexts.join(' ').trim();
      console.log("[extractText] Resultado final:", result);
      return result;
    } catch (error) {
      console.error("Error extracting text from coordinates:", error);
      return '';
    }
  };

  const handleSearch = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setSearchResults([]);
      setSearchTerm("");
      return;
    }

    // Normaliza a frase de busca igual ao texto extraído
    const normalizedTerm = term
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    setIsSearching(true);
    setSearchTerm(normalizedTerm);
    const results: number[] = [];

    try {
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc) {
        console.warn("[search] PDF document not yet loaded");
        setIsSearching(false);
        return;
      }

      for (let i = 1; i <= numPages; i++) {
        let text = pageTexts.get(i);
        if (!text) {
          text = await extractTextFromPage(i, pdfDoc);
          setPageTexts(prev => new Map(prev).set(i, text));
        }

        if (text.includes(normalizedTerm)) {
          results.push(i);
        }
      }

      setSearchResults(results);
      setCurrentResultIndex(0);

      if (results.length > 0) {
        changePage(results[0]);
      }
    } catch (error) {
      console.error("Error searching PDF:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNextResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(nextIndex);
    changePage(searchResults[nextIndex]);
  };

  const handlePrevResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = currentResultIndex === 0 ? searchResults.length - 1 : currentResultIndex - 1;
    setCurrentResultIndex(prevIndex);
    changePage(searchResults[prevIndex]);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setCurrentResultIndex(0);
  };

  const changePage = (page: number) => {
    setPageNumber(page);
    onPageChange?.(page);
  };

  const goToPrevPage = () => {
    const newPage = Math.max(pageNumber - 1, 1);
    changePage(newPage);
  };

  const goToNextPage = () => {
    const newPage = Math.min(pageNumber + 1, numPages);
    changePage(newPage);
  };

  const zoomIn = useCallback(() => {
    setAutoFit(false);
    setScale((prevScale) => {
      const newScale = Math.min(prevScale + 0.2, 3.0);
      onScaleChange?.(newScale);
      return newScale;
    });
  }, [onScaleChange]);

  const zoomOut = useCallback(() => {
    setAutoFit(false);
    setScale((prevScale) => {
      const newScale = Math.max(prevScale - 0.2, 0.5);
      onScaleChange?.(newScale);
      return newScale;
    });
  }, [onScaleChange]);

  const fitToWidth = useCallback(() => {
    setAutoFit(true);
    if (containerRef.current) {
      // Calculate scale to fit width (accounting for padding)
      const containerWidth = containerRef.current.clientWidth - 40;
      const pageWidth = 595; // Standard PDF page width in points
      const newScale = containerWidth / pageWidth;
      const clampedScale = Math.max(0.5, Math.min(newScale, 3.0));
      setScale(clampedScale);
      onScaleChange?.(clampedScale);
    }
  }, [onScaleChange]);

  useEffect(() => {
    if (autoFit) {
      fitToWidth();
    }
  }, [autoFit, pageNumber, fitToWidth]);

  useEffect(() => {
    const handleResize = () => {
      if (autoFit) {
        fitToWidth();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoFit, fitToWidth]);

  // Overlay visual de debug (ativado por ?pdfdebug=1 ou localStorage.PDF_DEBUG='1').
  const DebugOverlay = () => {
    if (!debugEnabled) return null;
    const shortWorker = currentWorkerSrc.startsWith("/")
      ? `local: ${currentWorkerSrc}`
      : currentWorkerSrc.includes("jsdelivr")
        ? "cdn: jsdelivr"
        : currentWorkerSrc.includes("unpkg")
          ? "cdn: unpkg"
          : currentWorkerSrc;
    return (
      <div className="fixed bottom-2 right-2 z-[9999] max-w-[92vw] sm:max-w-sm rounded-md border border-border bg-background/95 backdrop-blur shadow-lg p-2 text-[10px] leading-tight font-mono">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-bold text-primary">PDF DEBUG</span>
          <button
            onClick={() => {
              try { window.localStorage?.removeItem("PDF_DEBUG"); } catch { /* noop */ }
              setDebugEvents([]);
              window.location.search = window.location.search.replace(/[?&]pdfdebug=1/, "");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
        <div>modo: <b>{compatibilityMode ? "nativo (iframe)" : "completo (PDF.js)"}</b></div>
        <div>worker: <b>{shortWorker}</b></div>
        <div>fallback #: <b>{workerFallbackIndexRef.current}/{workerFallbacks.length}</b></div>
        <div>
          auto-lock: <b className={autoCompatLockedRef.current ? "text-amber-500" : "text-muted-foreground"}>
            {autoCompatLockedRef.current ? `🔒 ${lockReason ?? "ativo"}` : "livre"}
          </b>
        </div>
        <div>retries: <b>{retryCount}/{MAX_RETRIES}</b></div>
        <details className="mt-1">
          <summary className="cursor-pointer text-muted-foreground">eventos ({debugEvents.length})</summary>
          <div className="max-h-40 overflow-auto mt-1 space-y-0.5">
            {debugEvents.slice().reverse().map((e, i) => (
              <div
                key={i}
                className={
                  e.level === "error" ? "text-destructive"
                  : e.level === "warn" ? "text-amber-500"
                  : "text-foreground"
                }
              >
                <span className="text-muted-foreground">{e.ts}</span> {e.msg}
              </div>
            ))}
          </div>
        </details>
      </div>
    );
  };

  // Modo de compatibilidade: visualizador nativo do navegador via <iframe>
  if (compatibilityMode && typeof fileUrl === "string") {
    return (
      <div ref={containerRef} className="flex flex-col items-center gap-3 w-full">
        <DebugOverlay />
        <div className="w-full max-w-3xl rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <Monitor className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">
              Leitor nativo {autoCompatLockedRef.current ? "(auto-fallback)" : "(escolha do usuário)"}
            </p>
            <p className="opacity-90 mt-0.5">
              {autoCompatLockedRef.current
                ? `Motivo: ${lockReason ?? "falha no leitor completo"}. Marca-texto, busca interna e zoom customizado ficam temporariamente indisponíveis.`
                : "Exibindo no leitor nativo do navegador conforme sua preferência."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={exitCompatibilityMode}
            className="shrink-0 gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Leitor completo
          </Button>
        </div>
        <iframe
          src={fileUrl}
          title="Visualizador PDF (modo de compatibilidade)"
          className="w-full h-[80vh] border border-border rounded-lg bg-muted/20"
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              Abrir em nova aba
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar à biblioteca
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4 w-full">
      <DebugOverlay />


      {/* Mode indicator + manual switch */}
      <div className="w-full max-w-3xl rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs sm:text-sm text-foreground flex items-center gap-2">
        <BookOpen className="w-4 h-4 shrink-0 text-primary" />
        <span className="font-medium">Leitor completo</span>
        <span className="text-muted-foreground hidden sm:inline">— marca-texto, busca e zoom disponíveis</span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={enterCompatibilityMode}
          className="shrink-0 gap-1 h-7 px-2 text-xs"
          title="Alternar para o leitor nativo do navegador (útil se o PDF travar)"
        >
          <Monitor className="w-3.5 h-3.5" />
          Usar leitor nativo
        </Button>
      </div>

      {/* Controls with horizontal scroll on mobile */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="glass sticky top-20 z-40 rounded-lg p-3 flex items-center gap-2 min-w-max mx-auto w-fit">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="aura-soft shrink-0"
          >
            <ZoomOut className="w-5 h-5" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center shrink-0">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="aura-soft shrink-0"
          >
            <ZoomIn className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={fitToWidth}
            className={`aura-soft shrink-0 ${autoFit ? 'text-primary' : ''}`}
            title="Ajustar à largura"
          >
            <Maximize2 className="w-5 h-5" />
          </Button>
          
          <div className="h-6 w-px bg-border mx-2 shrink-0" />
          
          <div className="shrink-0">
            <PDFSearchBar
              onSearch={handleSearch}
              onNextResult={handleNextResult}
              onPrevResult={handlePrevResult}
              onClear={handleClearSearch}
              currentResultIndex={currentResultIndex}
              totalResults={searchResults.length}
              isSearching={isSearching}
            />
          </div>
          
          <div className="h-6 w-px bg-border mx-2 shrink-0" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="aura-soft shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-sm font-medium min-w-[80px] text-center shrink-0">
            {pageNumber} / {numPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="aura-soft shrink-0"
            title={isPageCached(pageNumber + 1) ? "Próxima página (pré-carregada)" : "Próxima página"}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      {/* Bookmark indicator - visible and spaced properly */}
      {bookmarkIndicator && (
        <div className="w-full flex justify-center px-4 -mt-2">
          {bookmarkIndicator}
        </div>
      )}

      {/* PDF Document */}
      <div 
        ref={pageRef}
        className={`border border-border rounded-lg overflow-auto shadow-lg bg-muted/20 relative ${isDrawingMode ? 'drawing-mode' : ''}`}
      >
        
        <Document
          key={loadAttempt}
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(error: Error) => {
            const cause = classifyPdfError(error, fileUrl);
            const ctx = {
              likelyCause: cause.title,
              likelyCauseHint: cause.hint,
              fileUrl: typeof fileUrl === "string" ? fileUrl : "[non-string file]",
              fileName:
                typeof fileUrl === "string"
                  ? fileUrl.split("?")[0].split("/").pop()
                  : undefined,
              errorName: error?.name,
              errorMessage: error?.message,
              stack: error?.stack,
              currentWorkerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
              userAgent:
                typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
              platform:
                typeof navigator !== "undefined" ? navigator.platform : "n/a",
              timestamp: new Date().toISOString(),
            };
            console.error("[PDFViewer] Falha ao carregar PDF:", ctx);

            // Fallback automático para falhas de worker antes de exibir erro
            if (cause.title === "Worker do PDF.js não carregou") {
              if (tryWorkerFallback()) {
                console.info("[PDFViewer] Aplicando fallback de worker automaticamente.");
                return; // não exibe erro nem reporta a Sentry — nova tentativa em curso
              }
              // Esgotou CDNs: ativa modo de compatibilidade (visualizador nativo)
              lockAutoCompat("Todos os workers do PDF.js falharam (local + CDNs)");
              setCompatibilityMode(true);
              setLoadError(null);
              return;
            }


            setLoadError(error);
            try {
              captureError(error, { tags: { component: "PDFViewer" }, extra: ctx });
            } catch (e) {
              console.warn("[PDFViewer] captureError falhou:", e);
            }
          }}
          onSourceError={(error: Error) => {
            setLoadError(error);
            console.error("[PDFViewer] Falha na fonte do PDF:", {
              fileUrl,
              errorMessage: error?.message,
              stack: error?.stack,
            });
          }}
          loading={
            <div className="flex items-center justify-center p-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
          error={
            <div className="p-8 sm:p-12 text-center flex flex-col items-center gap-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Não foi possível abrir o PDF</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  O arquivo pode estar corrompido, indisponível ou sua conexão caiu.
                </p>
                {(() => {
                  const cause = classifyPdfError(loadError, fileUrl);
                  return (
                    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-left">
                      <p className="text-xs font-semibold">
                        Causa provável: <span className="text-primary">{cause.title}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{cause.hint}</p>
                      {loadError?.message && (
                        <p className="text-[10px] text-muted-foreground/70 mt-2 font-mono break-all">
                          {loadError.message}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="flex flex-col items-center gap-2">
                {retryCount >= MAX_RETRIES ? (
                  <p className="text-xs text-destructive">
                    Limite de {MAX_RETRIES} tentativas atingido.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Tentativa {retryCount} de {MAX_RETRIES}
                    {retryDelay > 0 && ` — reabrindo em ${retryDelay}s...`}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    onClick={handleRetry}
                    disabled={retryCount >= MAX_RETRIES || retryDelay > 0}
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${retryDelay > 0 ? "animate-spin" : ""}`} />
                    {retryDelay > 0 ? `Aguardando ${retryDelay}s` : "Tentar novamente"}
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/library")} className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Voltar à biblioteca
                  </Button>
                </div>
              </div>
            </div>
          }
        >
          <div className="relative">
            <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                onLoadSuccess={(page) => {
                  setPageSize({
                    width: page.width,
                    height: page.height,
                  });
                }}
              loading={
                <div className="flex items-center justify-center p-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              }
              customTextRenderer={(textItem) => {
                const text = 'str' in textItem ? textItem.str : '';
                
                // Priority: spoken text highlight (audiobook sync)
                if (spokenText && spokenText.length > 3) {
                  const normalizedText = text.toLowerCase();
                  const normalizedSpoken = spokenText.toLowerCase();
                  if (normalizedText.includes(normalizedSpoken) || normalizedSpoken.includes(normalizedText)) {
                    return `<mark style="background: linear-gradient(135deg, hsl(210 100% 60% / 0.4), hsl(210 100% 70% / 0.3)); color: inherit; padding: 2px 4px; border-radius: 3px; animation: pulse 1.5s ease-in-out infinite;">${text}</mark>`;
                  }
                }
                
                // Secondary: search term highlight (normaliza para casar com acentos)
                if (searchTerm) {
                  const normalize = (s: string) =>
                    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  const normText = normalize(text);
                  const normTerm = searchTerm;
                  if (normTerm && normText.includes(normTerm)) {
                    // Reconstrói com marcação preservando texto original (com acentos)
                    let result = '';
                    let i = 0;
                    while (i < text.length) {
                      const slice = normalize(text.slice(i, i + normTerm.length));
                      if (slice === normTerm) {
                        const original = text.slice(i, i + normTerm.length);
                        const isActive = searchResults[currentResultIndex] === pageNumber;
                        const bg = isActive ? '#fb923c' : '#fef08a';
                        const ring = isActive ? 'box-shadow:0 0 0 2px #ea580c;' : '';
                        result += `<mark style="background-color:${bg};color:#000;padding:2px 0;border-radius:2px;${ring}">${original}</mark>`;
                        i += normTerm.length;
                      } else {
                        result += text[i];
                        i++;
                      }
                    }
                    return result;
                  }
                }
                return text;
              }}
              />
            
            {pageSize.width > 0 && pageSize.height > 0 && (
              <HighlightCanvas
                key={`canvas-${pageNumber}-${Math.round(pageSize.width)}-${Math.round(pageSize.height)}`}
                width={pageSize.width}
                height={pageSize.height}
                highlights={highlights.map(h => ({
                  ...h,
                  x: h.x * scale,
                  y: h.y * scale,
                  width: h.width * scale,
                  height: h.height * scale,
                }))}
                onHighlightAdded={async (coords) => {
                  // Extrair texto automaticamente das coordenadas
                  const text = await extractTextFromCoordinates(coords);
                  
                  // Salvar coordenadas normalizadas (para persistência)
                  const originalCoords = {
                    x: coords.x / scale,
                    y: coords.y / scale,
                    width: coords.width / scale,
                    height: coords.height / scale,
                  };
                  
                  const res = await onHighlightDrawn?.({ ...originalCoords, text, color: highlightColor });
                  return res ?? undefined;
                }}
                isDrawing={isDrawingMode}
                drawColor={highlightColor}
                minSelectionSize={penThickness}
              />
            )}
          </div>
        </Document>
      </div>
    </div>
  );
};
