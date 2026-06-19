import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, ExternalLink, AlertCircle, Highlighter, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PDFViewer } from "@/components/PDFViewer";
import { toast } from "sonner";

type SharedBook = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number | null;
  cover_image_url: string | null;
  cover_color: string | null;
};

type LocalHighlight = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
};

const storageKey = (token: string) => `auraread:shared:highlights:${token}`;

const loadLocalHighlights = (token: string): LocalHighlight[] => {
  try {
    const raw = localStorage.getItem(storageKey(token));
    return raw ? (JSON.parse(raw) as LocalHighlight[]) : [];
  } catch {
    return [];
  }
};

const saveLocalHighlights = (token: string, items: LocalHighlight[]) => {
  try {
    localStorage.setItem(storageKey(token), JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
};

const SharedBook = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<SharedBook | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [highlightColor] = useState("#fef08a");
  const [highlights, setHighlights] = useState<LocalHighlight[]>([]);

  useEffect(() => {
    if (token) setHighlights(loadLocalHighlights(token));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Token ausente");
        setLoading(false);
        return;
      }
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke(
          `public-shared-book?token=${encodeURIComponent(token)}`,
          { method: "GET" }
        );
        if (cancelled) return;
        if (invokeErr) {
          const msg =
            (invokeErr as any)?.context?.error ||
            invokeErr.message ||
            "Não foi possível abrir este link.";
          setError(typeof msg === "string" ? msg : "Não foi possível abrir este link.");
          setLoading(false);
          return;
        }
        if (!data || data.error) {
          setError(data?.error || "Link inválido ou expirado.");
          setLoading(false);
          return;
        }
        setBook(data.book);
        setPdfUrl(data.pdfUrl);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Erro ao abrir o link compartilhado.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Highlights da página atual no formato esperado pelo PDFViewer
  const pageHighlights = useMemo(
    () =>
      highlights
        .filter((h) => h.page === currentPage)
        .map((h) => ({ x: h.x, y: h.y, width: h.width, height: h.height, color: h.color })),
    [highlights, currentPage]
  );

  const handleHighlightDrawn = async (coords: {
    x: number; y: number; width: number; height: number; text: string; color: string;
  }) => {
    if (!token) return;
    const item: LocalHighlight = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      page: currentPage,
      x: coords.x,
      y: coords.y,
      width: coords.width,
      height: coords.height,
      color: coords.color || highlightColor,
      text: coords.text || "",
    };
    const next = [...highlights, item];
    setHighlights(next);
    saveLocalHighlights(token, next);
    toast.success("Destaque salvo neste navegador ✨", {
      description: "Faça login para sincronizar entre dispositivos.",
      duration: 3500,
    });
    return { id: item.id };
  };

  const clearAll = () => {
    if (!token) return;
    if (!confirm("Apagar todos os destaques salvos neste navegador?")) return;
    setHighlights([]);
    saveLocalHighlights(token, []);
    toast.success("Destaques apagados.");
  };

  return (
    <>
      <SEO
        title={book ? `${book.title} — AURA READ` : "Livro compartilhado — AURA READ"}
        description="Visualize um livro compartilhado pelo AURA READ sem precisar criar conta."
        path={`/shared/${token ?? ""}`}
        noindex
      />
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-border/40 px-4 py-3 flex items-center justify-between glass">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AURA READ
            </span>
          </Link>
          <Link to="/library">
            <Button size="sm" variant="outline">Entrar</Button>
          </Link>
        </header>

        <main className="flex-1 flex flex-col">
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {!loading && error && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="glass rounded-2xl p-8 max-w-md text-center aura-soft">
                <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
                <h1 className="text-xl font-bold mb-2">Não foi possível abrir</h1>
                <p className="text-sm text-muted-foreground mb-6">{error}</p>
                <Link to="/">
                  <Button>Ir para AURA READ</Button>
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && book && (
            <>
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h1 className="font-semibold truncate">{book.title}</h1>
                  {book.author && (
                    <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isDrawingMode ? "default" : "outline"}
                    onClick={() => setIsDrawingMode((v) => !v)}
                    className="gap-2"
                    title="Marca-texto (salvo neste navegador)"
                  >
                    <Highlighter
                      className="w-4 h-4"
                      style={{ color: isDrawingMode ? highlightColor : undefined }}
                    />
                    {isDrawingMode ? "Marcando…" : "Marcar"}
                  </Button>
                  {highlights.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearAll}
                      className="gap-2 text-destructive hover:text-destructive"
                      title="Apagar destaques deste navegador"
                    >
                      <Trash2 className="w-4 h-4" />
                      Limpar ({highlights.length})
                    </Button>
                  )}
                  {pdfUrl && (
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Abrir PDF
                      </Button>
                    </a>
                  )}
                </div>
              </div>
              <div className="flex-1 bg-black/40">
                {pdfUrl ? (
                  <PDFViewer
                    fileUrl={pdfUrl}
                    initialPage={1}
                    onPageChange={setCurrentPage}
                    highlights={pageHighlights}
                    isDrawingMode={isDrawingMode}
                    highlightColor={highlightColor}
                    onHighlightDrawn={handleHighlightDrawn}
                  />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    PDF indisponível.
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
};

export default SharedBook;
