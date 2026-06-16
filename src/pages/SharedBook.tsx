import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, ExternalLink, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SharedBook = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number | null;
  cover_image_url: string | null;
  cover_color: string | null;
};

const SharedBook = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<SharedBook | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

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
          // supabase-js wraps non-2xx into error; try parse context
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
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-semibold truncate">{book.title}</h1>
                  {book.author && (
                    <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                  )}
                </div>
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Abrir PDF
                    </Button>
                  </a>
                )}
              </div>
              <div className="flex-1 bg-black/40">
                {pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    title={book.title}
                    className="w-full h-full min-h-[70vh] border-0"
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
