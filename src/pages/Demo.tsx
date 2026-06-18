import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Highlighter, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Default value when nothing is configured. Override at runtime via:
//   1. URL: /demo?banner=5   (highest priority, also persists)
//   2. localStorage key 'auraread:demo:banner-threshold'
//   3. DevTools console: localStorage.setItem('auraread:demo:banner-threshold','5')
const DEFAULT_HIGHLIGHTS_THRESHOLD = 3;
const THRESHOLD_KEY = "auraread:demo:banner-threshold";
const BANNER_DISMISS_KEY = "auraread:demo:banner-dismissed";

const resolveThreshold = (): number => {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("banner");
    if (fromUrl) {
      const n = Number.parseInt(fromUrl, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 100) {
        localStorage.setItem(THRESHOLD_KEY, String(n));
        return n;
      }
    }
    const stored = localStorage.getItem(THRESHOLD_KEY);
    if (stored) {
      const n = Number.parseInt(stored, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 100) return n;
    }
  } catch {
    // ignore — fall through to default
  }
  return DEFAULT_HIGHLIGHTS_THRESHOLD;
};

type BannerEvent = "banner_shown" | "banner_dismissed" | "banner_clicked";

/**
 * Fire-and-forget analytics tracker for the demo upsell banner.
 * Routes through Google Analytics (gtag) when present, falls back to
 * Sentry breadcrumb + console for local development.
 */
const trackBannerEvent = (
  event: BannerEvent,
  payload: { threshold: number; highlights_count: number },
) => {
  try {
    const w = window as typeof window & {
      gtag?: (...args: unknown[]) => void;
    };
    w.gtag?.("event", event, {
      event_category: "demo_upsell_banner",
      ...payload,
    });
    // Always emit a console log so manual QA can verify without GA loaded.
    // eslint-disable-next-line no-console
    console.info(`[analytics] ${event}`, payload);
  } catch {
    // never let analytics break UX
  }
};


interface DemoBook {
  id: string;
  title: string;
  author: string;
  pages: number;
  accent: string;
  excerpt: string;
}

interface DemoHighlight {
  id: string;
  bookId: string;
  text: string;
  createdAt: number;
}

const INITIAL_BOOKS: DemoBook[] = [
  {
    id: "1",
    title: "A Arte de Ler com Profundidade",
    author: "Mariana Costa",
    pages: 248,
    accent: "from-primary/80 to-primary",
    excerpt:
      "A leitura profunda exige presença. Não basta passar os olhos pelas linhas — é preciso habitar o texto, deixar que cada parágrafo se desdobre dentro de você. Quando lemos com atenção plena, descobrimos camadas que escapam ao olhar apressado, e o livro deixa de ser objeto para se tornar conversa. Esse é o convite: desacelere, sublinhe, releia, anote. A pressa rouba o sentido; a calma o devolve.",
  },
  {
    id: "2",
    title: "Hábitos que Transformam",
    author: "Ricardo Mendes",
    pages: 312,
    accent: "from-amber-500/80 to-amber-600",
    excerpt:
      "Pequenas ações repetidas todos os dias constroem identidades inteiras. Você não se torna leitor por ler um livro — torna-se leitor pelo gesto diário de abrir páginas, mesmo quando o cansaço sussurra que amanhã seria melhor. A consistência vence a intensidade. O segredo não está na grande virada, mas no compromisso silencioso com o próximo capítulo.",
  },
  {
    id: "3",
    title: "Mentes em Movimento",
    author: "Júlia Albuquerque",
    pages: 196,
    accent: "from-emerald-500/80 to-emerald-600",
    excerpt:
      "O cérebro humano é plástico: cada nova ideia abre um caminho, cada releitura aprofunda o sulco. Marcar trechos não é vaidade de leitor — é arquitetura cognitiva. Quando destacamos uma frase, criamos um ponto de ancoragem ao qual a memória poderá retornar. A biblioteca pessoal de marca-textos é, no fim, um mapa do que pensamos.",
  },
];

const STORAGE_KEY = "auraread:demo:highlights";

const loadHighlights = (): DemoHighlight[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoHighlight[]) : [];
  } catch {
    return [];
  }
};

const saveHighlights = (next: DemoHighlight[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors silently in demo
  }
};

const Demo = () => {
  const [books, setBooks] = useState<DemoBook[]>(INITIAL_BOOKS);
  const [activeBook, setActiveBook] = useState<DemoBook | null>(null);
  const [highlights, setHighlights] = useState<DemoHighlight[]>(loadHighlights);
  const [selection, setSelection] = useState<string>("");
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BANNER_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const dismissBanner = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(BANNER_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  const [threshold] = useState<number>(resolveThreshold);
  const showBanner = highlights.length >= threshold && !bannerDismissed;

  const persist = (next: DemoHighlight[]) => {
    setHighlights(next);
    saveHighlights(next);
  };

  const handleAddBook = () => {
    const id = crypto.randomUUID();
    setBooks((prev) => [
      ...prev,
      {
        id,
        title: `Novo PDF #${prev.length + 1}`,
        author: "Você",
        pages: Math.floor(Math.random() * 200) + 80,
        accent: "from-violet-500/80 to-violet-600",
        excerpt:
          "Este é um PDF de demonstração. Selecione qualquer trecho deste texto e clique em ‘Marcar trecho’ para vê-lo aparecer no painel de resumo à direita.",
      },
    ]);
    toast.success("PDF adicionado à biblioteca (simulado)");
  };

  const handleSelection = () => {
    const text = window.getSelection()?.toString().trim() ?? "";
    setSelection(text);
  };

  const handleHighlight = () => {
    if (!activeBook || selection.length < 3) {
      toast.error("Selecione ao menos 3 caracteres do texto");
      return;
    }
    const next: DemoHighlight = {
      id: crypto.randomUUID(),
      bookId: activeBook.id,
      text: selection,
      createdAt: Date.now(),
    };
    persist([next, ...highlights]);
    window.getSelection()?.removeAllRanges();
    setSelection("");
    toast.success("Trecho salvo no resumo");
  };

  const handleDelete = (id: string) => {
    persist(highlights.filter((h) => h.id !== id));
  };

  const bookHighlights = useMemo(
    () => (activeBook ? highlights.filter((h) => h.bookId === activeBook.id) : highlights),
    [highlights, activeBook],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Demo · Biblioteca e Leitor AuraRead</title>
        <meta
          name="description"
          content="Experimente a biblioteca de PDFs e o marca-texto simulado do AuraRead. Selecione trechos e veja-os aparecer no resumo em tempo real."
        />
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="border-b border-border bg-card/40 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {activeBook ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveBook(null)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Biblioteca
              </Button>
            ) : (
              <Sparkles className="h-5 w-5 text-primary" />
            )}
            <div>
              <h1 className="text-lg font-semibold leading-none">
                {activeBook ? activeBook.title : "Minha Biblioteca"}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeBook
                  ? `${activeBook.author} · ${activeBook.pages} páginas`
                  : "Modo demonstração — dados não persistem no servidor"}
              </p>
            </div>
          </div>

          {!activeBook && (
            <Button onClick={handleAddBook} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar PDF
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {!activeBook ? (
            <motion.section
              key="grid"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">
                    {books.length} {books.length === 1 ? "livro" : "livros"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Clique em qualquer card para abrir o leitor e marcar trechos.
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Highlighter className="h-3 w-3" />
                  {highlights.length} destaques salvos
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {books.map((book) => (
                  <motion.button
                    key={book.id}
                    onClick={() => setActiveBook(book)}
                    whileHover={{ y: -4 }}
                    className="group text-left"
                  >
                    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                      <div
                        className={cn(
                          "aspect-[3/4] w-full bg-gradient-to-br p-6 text-primary-foreground",
                          book.accent,
                        )}
                      >
                        <p className="text-xs opacity-80">PDF</p>
                        <p className="mt-4 line-clamp-4 text-lg font-semibold leading-tight">
                          {book.title}
                        </p>
                      </div>
                      <CardHeader className="pb-2">
                        <p className="line-clamp-1 text-sm font-medium">{book.title}</p>
                        <p className="text-xs text-muted-foreground">{book.author}</p>
                      </CardHeader>
                      <CardFooter className="flex items-center justify-between pt-0 text-xs text-muted-foreground">
                        <span>{book.pages} páginas</span>
                        <span>
                          {highlights.filter((h) => h.bookId === book.id).length} destaques
                        </span>
                      </CardFooter>
                    </Card>
                  </motion.button>
                ))}

                <motion.button
                  onClick={handleAddBook}
                  whileHover={{ y: -4 }}
                  className="group"
                >
                  <Card className="flex aspect-[3/4] flex-col items-center justify-center border-dashed bg-card/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                    <Upload className="mb-3 h-8 w-8" />
                    <p className="text-sm font-medium">Adicionar PDF</p>
                    <p className="mt-1 text-xs">simulado</p>
                  </Card>
                </motion.button>
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="reader"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
            >
              <Card className="overflow-hidden">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Selecione um trecho e clique em <strong>Marcar trecho</strong>.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleHighlight}
                      disabled={selection.length < 3}
                      className="gap-2"
                    >
                      <Highlighter className="h-4 w-4" />
                      Marcar trecho
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="prose prose-neutral dark:prose-invert max-w-none px-8 py-10">
                  <p
                    onMouseUp={handleSelection}
                    onTouchEnd={handleSelection}
                    className="text-lg leading-relaxed selection:bg-yellow-200 selection:text-foreground"
                  >
                    {activeBook.excerpt}
                  </p>
                  {selection && (
                    <p className="mt-6 rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                      Seleção atual: <span className="text-foreground">“{selection}”</span>
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="flex h-full max-h-[640px] flex-col">
                <CardHeader className="border-b">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Resumo · destaques</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {bookHighlights.length}
                    </Badge>
                  </div>
                </CardHeader>
                <ScrollArea className="flex-1">
                  <div className="space-y-3 p-4">
                    {bookHighlights.length === 0 && (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        Nenhum destaque ainda. Marque um trecho para começar seu resumo.
                      </p>
                    )}
                    {bookHighlights.map((h) => (
                      <motion.div
                        key={h.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="group rounded-md border bg-yellow-50 p-3 text-sm dark:bg-yellow-500/10"
                      >
                        <p className="leading-relaxed text-foreground">“{h.text}”</p>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{new Date(h.createdAt).toLocaleTimeString()}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(h.id)}
                            className="h-7 gap-1 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remover
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/80"
            role="region"
            aria-label="Convite para criar conta"
          >
            <div className="container mx-auto flex flex-col items-start gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Você já salvou {highlights.length} destaques nesta demo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Crie sua conta grátis para guardar tudo na nuvem, gerar resumos com IA e
                    acessar de qualquer dispositivo.
                  </p>
                </div>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Button asChild className="flex-1 gap-2 sm:flex-initial">
                  <Link to="/library">
                    Criar conta grátis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={dismissBanner}
                  aria-label="Dispensar convite"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Demo;
