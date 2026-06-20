import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { pdfjs } from "react-pdf";
import { normalizeSearch } from "@/lib/searchNormalize";
import { toast } from "sonner";
import {
  getCachedPageIndex,
  setCachedPageIndex,
  clearCachedPageIndex,
  type PageIndexEntry,
} from "@/lib/pageIndexCache";

interface ReaderPageSearchProps {
  pdfUrl: string;
  bookId: string;
  /** Versão do livro (ex.: book.updated_at). Quando muda, o cache é invalidado. */
  bookVersion?: string | null;
  totalPages?: number;
  onNavigateToPage: (page: number) => void;
}

interface PageMatch {
  page: number;
  snippet: string;
}

/**
 * Busca por frase em todo o PDF (lupa no header).
 * Indexa textContent de todas as páginas sob demanda, normaliza acentos,
 * lista páginas que contêm a frase e navega ao clicar.
 */
export const ReaderPageSearch = ({
  pdfUrl,
  bookId,
  bookVersion,
  totalPages,
  onNavigateToPage,
}: ReaderPageSearchProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [diag, setDiag] = useState<PageIndexEntry | null>(null);
  const [reindexNonce, setReindexNonce] = useState(0);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [lastStatus, setLastStatus] = useState<"idle" | "indexing" | "done" | "error">("idle");
  const [workerInfo, setWorkerInfo] = useState<{ src: string; fallbackUsed: boolean; lastError: string | null }>({
    src: pdfjs.GlobalWorkerOptions.workerSrc || "",
    fallbackUsed: false,
    lastError: null,
  });
  type WorkerAttempt = { ts: number; src: string; status: "ok" | "error" | "switched"; error?: string };
  const [workerHistory, setWorkerHistory] = useState<WorkerAttempt[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const pushAttempt = (a: WorkerAttempt) =>
    setWorkerHistory((h) => [a, ...h].slice(0, 20));
  const workerFallbacksRef = useRef<string[]>([
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
  ]);
  const workerFallbackIdxRef = useRef(0);
  const indexedKeyRef = useRef<string>("");

  const currentVersion = bookVersion ?? "v0";
  const currentKey = `${bookId}::${currentVersion}`;

  // Diagnóstico: habilitado via ?debug=1 ou localStorage["aurareader:debug"]="1"
  const debugEnabled = (() => {
    if (typeof window === "undefined") return false;
    try {
      if (new URLSearchParams(window.location.search).get("debug") === "1") return true;
      return window.localStorage.getItem("aurareader:debug") === "1";
    } catch {
      return false;
    }
  })();

  // Re-lê a entrada do IndexedDB para o painel de diagnóstico
  const refreshDiag = async () => {
    if (!bookId || !debugEnabled) return;
    const c = await getCachedPageIndex(bookId);
    setDiag(c);
  };
  useEffect(() => {
    refreshDiag();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, currentVersion, indexing]);

  // Atalho Ctrl/Cmd+Shift+F para abrir
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Carrega cache se bookId/version baterem; caso contrário descarta (invalidação)
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      const cached = await getCachedPageIndex(bookId);
      if (cancelled) return;
      if (cached && cached.version === currentVersion) {
        setPages(cached.pages);
        indexedKeyRef.current = currentKey;
      } else {
        // Versão diferente -> cache obsoleto, força reindexar
        setPages([]);
        indexedKeyRef.current = "";
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, currentVersion, currentKey]);

  // Indexa o PDF ao abrir; persiste no IndexedDB com a versão atual
  useEffect(() => {
    if (!open || !pdfUrl || !bookId) return;
    if (indexedKeyRef.current === currentKey && pages.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        setIndexing(true);
        setLastStatus("indexing");
        const task = pdfjs.getDocument(pdfUrl);
        const doc = await task.promise;
        const n = doc.numPages;
        setProgress({ current: 0, total: n });
        const collected: string[] = new Array(n).fill("");
        for (let i = 1; i <= n; i++) {
          if (cancelled) return;
          try {
            const page = await doc.getPage(i);
            const tc = await page.getTextContent();
            const text = (tc.items as any[])
              .map((it) => (typeof it?.str === "string" ? it.str : ""))
              .join(" ");
            collected[i - 1] = text;
          } catch {
            collected[i - 1] = "";
          }
          if (!cancelled) setProgress({ current: i, total: n });
        }
        if (!cancelled) {
          setPages(collected);
          indexedKeyRef.current = currentKey;
          await setCachedPageIndex({
            bookId,
            pages: collected,
            numPages: n,
            version: currentVersion,
            indexedAt: Date.now(),
          });
          setLastStatus("done");
          pushAttempt({ ts: Date.now(), src: pdfjs.GlobalWorkerOptions.workerSrc || "", status: "ok" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[ReaderPageSearch] index error", err);
        const currentSrc = pdfjs.GlobalWorkerOptions.workerSrc || "";
        pushAttempt({ ts: Date.now(), src: currentSrc, status: "error", error: msg });
        const isWorkerErr = /worker|fake worker|module specifier|pdf\.worker|importScripts/i.test(msg);
        if (isWorkerErr && workerFallbackIdxRef.current < workerFallbacksRef.current.length) {
          const nextSrc = workerFallbacksRef.current[workerFallbackIdxRef.current++];
          pdfjs.GlobalWorkerOptions.workerSrc = nextSrc;
          setWorkerInfo({ src: nextSrc, fallbackUsed: true, lastError: msg });
          pushAttempt({ ts: Date.now(), src: nextSrc, status: "switched" });
          console.warn("[ReaderPageSearch] worker fallback ->", nextSrc);
          if (!cancelled) {
            toast.message("Worker local falhou. Tentando CDN…");
            indexedKeyRef.current = "";
            setPages([]);
            setReindexNonce((n) => n + 1);
          }
        } else if (!cancelled) {
          setWorkerInfo((w) => ({ ...w, lastError: msg }));
          setLastStatus("error");
          toast.error("Não foi possível indexar o PDF para busca.");
        }
      } finally {
        if (!cancelled) setIndexing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pdfUrl, bookId, currentKey, currentVersion, pages.length, reindexNonce]);


  const matches = useMemo<PageMatch[]>(() => {
    const q = normalizeSearch(query).trim();
    if (!q || pages.length === 0) return [];
    const out: PageMatch[] = [];
    for (let i = 0; i < pages.length; i++) {
      const raw = pages[i];
      const norm = normalizeSearch(raw);
      const at = norm.indexOf(q);
      if (at >= 0) {
        const start = Math.max(0, at - 40);
        const end = Math.min(raw.length, at + q.length + 40);
        const snippet = raw.slice(start, end).replace(/\s+/g, " ").trim();
        out.push({
          page: i + 1,
          snippet: (start > 0 ? "…" : "") + snippet + (end < raw.length ? "…" : ""),
        });
      }
    }
    return out;
  }, [query, pages]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const go = (idx: number) => {
    if (matches.length === 0) return;
    const safe = (idx + matches.length) % matches.length;
    setActiveIdx(safe);
    onNavigateToPage(matches[safe].page);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Buscar frase no PDF (Ctrl+Shift+F)"
          title="Buscar frase no PDF (Ctrl+Shift+F)"
          className="aura-soft transition-aura"
        >
          <Search className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-2">
        <div className="relative mb-2">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.shiftKey ? go(activeIdx - 1) : go(activeIdx + 1);
              }
            }}
            placeholder="Buscar frase no livro…"
            className="pl-8 pr-8"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs text-muted-foreground">
            {indexing
              ? "Indexando páginas…"
              : query.trim()
              ? `${matches.length} ocorrência(s)`
              : `${pages.length || totalPages || 0} páginas indexadas`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={matches.length === 0}
              onClick={() => go(activeIdx - 1)}
              aria-label="Anterior"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={matches.length === 0}
              onClick={() => go(activeIdx + 1)}
              aria-label="Próxima"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {indexing && pages.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Lendo PDF…
            </div>
          ) : matches.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">
              {query.trim() ? "Nenhuma página encontrada." : "Digite uma frase para buscar."}
            </p>
          ) : (
            matches.map((m, i) => (
              <button
                key={`${m.page}-${i}`}
                onClick={() => {
                  setActiveIdx(i);
                  onNavigateToPage(m.page);
                }}
                className={`w-full text-left p-2 rounded-md hover:bg-muted transition-colors ${
                  i === activeIdx ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-primary">Página {m.page}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{m.snippet}</p>
              </button>
            ))
          )}
        </div>

        {debugEnabled && (
          <div className="mt-2 border-t border-border/60 pt-2 px-1 space-y-0.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Diagnóstico (read-only)
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => {
                    try {
                      // Força nova instância do worker no próximo getDocument
                      const newSrc = new URL(
                        "pdfjs-dist/build/pdf.worker.min.mjs",
                        import.meta.url,
                      ).toString() + `?t=${Date.now()}`;
                      pdfjs.GlobalWorkerOptions.workerSrc = newSrc;
                      workerFallbackIdxRef.current = 0;
                      setWorkerInfo({ src: newSrc, fallbackUsed: false, lastError: null });
                      console.log("[ReaderPageSearch] workerSrc resetado:", newSrc);
                      // Reindexa imediatamente para validar o worker
                      setOpen(true);
                      indexedKeyRef.current = "";
                      setPages([]);
                      setReindexNonce((n) => n + 1);
                      toast.success("Worker do PDF.js reinicializado.");
                    } catch (err) {
                      console.error("[ReaderPageSearch] retry worker failed", err);
                      toast.error("Falha ao reinicializar o worker.");
                    }
                  }}
                >
                  Retry PDF worker
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={!bookId || indexing || !pdfUrl}
                  onClick={() => {
                    setOpen(true);
                    indexedKeyRef.current = "";
                    setPages([]);
                    setReindexNonce((n) => n + 1);
                    toast.info("Reindexando…");
                  }}
                >
                  Reindexar agora
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={!bookId || indexing}
                  onClick={async () => {
                    await clearCachedPageIndex(bookId);
                    indexedKeyRef.current = "";
                    setPages([]);
                    await refreshDiag();
                    toast.success("Cache limpo para este livro.");
                  }}
                >
                  Limpar cache
                </Button>
              </div>
            </div>
            {(() => {
              const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
              const statusLabel = indexing
                ? `Indexando… ${progress.current}/${progress.total} (${pct}%)`
                : lastStatus === "done"
                ? `Concluído — ${progress.total || pages.length} páginas`
                : lastStatus === "error"
                ? "Erro ao indexar"
                : pages.length > 0
                ? `Pronto — ${pages.length} páginas em cache`
                : "Aguardando…";
              const statusColor = indexing
                ? "text-primary"
                : lastStatus === "error"
                ? "text-destructive"
                : lastStatus === "done"
                ? "text-primary"
                : "text-muted-foreground";
              return (
                <div className="mb-1.5">
                  <div className={`flex items-center gap-1.5 text-[10px] font-mono ${statusColor}`}>
                    {indexing && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{statusLabel}</span>
                  </div>
                  {indexing && (
                    <div className="mt-1 h-1 w-full bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}
            <dl className="text-[11px] font-mono leading-snug grid grid-cols-[88px_1fr] gap-x-2">
              <dt className="text-muted-foreground">bookId</dt>
              <dd className="truncate" title={bookId}>{bookId || "—"}</dd>
              <dt className="text-muted-foreground">version (livro)</dt>
              <dd className="truncate" title={currentVersion}>{currentVersion}</dd>
              <dt className="text-muted-foreground">cache.version</dt>
              <dd className="truncate" title={diag?.version ?? ""}>
                {diag?.version ?? "—"}
                {diag && diag.version !== currentVersion && (
                  <span className="ml-1 text-destructive">(obsoleto)</span>
                )}
                {diag && diag.version === currentVersion && (
                  <span className="ml-1 text-primary">(válido)</span>
                )}
              </dd>
              <dt className="text-muted-foreground">cache.indexedAt</dt>
              <dd>{diag?.indexedAt ? new Date(diag.indexedAt).toLocaleString() : "—"}</dd>
              <dt className="text-muted-foreground">cache.numPages</dt>
              <dd>{diag?.numPages ?? "—"}</dd>
              <dt className="text-muted-foreground">worker.src</dt>
              <dd className="truncate" title={workerInfo.src}>
                {workerInfo.src ? workerInfo.src.split("/").slice(-2).join("/") : "—"}
                {workerInfo.fallbackUsed && (
                  <span className="ml-1 text-destructive">(fallback CDN)</span>
                )}
              </dd>
              {workerInfo.lastError && (
                <>
                  <dt className="text-muted-foreground">worker.error</dt>
                  <dd className="text-destructive break-words" title={workerInfo.lastError}>
                    {workerInfo.lastError.slice(0, 120)}
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
