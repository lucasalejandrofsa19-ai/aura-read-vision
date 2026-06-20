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
  const indexedKeyRef = useRef<string>("");

  const currentVersion = bookVersion ?? "v0";
  const currentKey = `${bookId}::${currentVersion}`;

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
        const task = pdfjs.getDocument(pdfUrl);
        const doc = await task.promise;
        const n = doc.numPages;
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
        }
      } catch (err) {
        console.error("[ReaderPageSearch] index error", err);
        if (!cancelled) toast.error("Não foi possível indexar o PDF para busca.");
      } finally {
        if (!cancelled) setIndexing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pdfUrl, bookId, currentKey, currentVersion, pages.length]);


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
      </PopoverContent>
    </Popover>
  );
};
