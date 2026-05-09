import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Share2, Sparkles, Loader2, FileDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Highlight } from "@/hooks/useHighlights";
import { ExportDialog } from "@/components/ExportDialog";
import { HighlightImageDialog } from "@/components/HighlightImageDialog";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { useAuth } from "@/contexts/AuthContext";
import { usePremiumValidation } from "@/hooks/usePremiumValidation";
import { pdfjs } from "@/lib/pdfjsWorker";

const Summary = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { validatePremiumAccess } = usePremiumValidation();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string>("");
  const [isPreview, setIsPreview] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [bookTitle, setBookTitle] = useState<string>("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [hasPremium, setHasPremium] = useState(false);
  const [bookSummary, setBookSummary] = useState<string>("");
  const [bookSummaryIsPreview, setBookSummaryIsPreview] = useState(false);
  const [generatingBookSummary, setGeneratingBookSummary] = useState(false);

  useEffect(() => {
    loadHighlights();
    checkPremiumAccess();
  }, [id]);

  const checkPremiumAccess = async () => {
    if (!user) return;
    const result = await validatePremiumAccess();
    setHasPremium(result.hasPremiumAccess);
  };

  const loadHighlights = async () => {
    if (!id) return;

    try {
      const { data: bookData, error: bookError } = await supabase
        .from("books")
        .select("title")
        .eq("id", id)
        .single();

      if (bookError) throw bookError;
      setBookTitle(bookData.title);

      const { data, error } = await supabase
        .from("highlights")
        .select("*")
        .eq("book_id", id)
        .order("page_number", { ascending: true });

      if (error) throw error;
      setHighlights((data || []) as Highlight[]);
    } catch (error) {
      console.error("Erro ao carregar destaques:", error);
      toast.error("Erro ao carregar destaques");
    } finally {
      setLoading(false);
    }
  };

  const generateBookSummary = async (preview: boolean = false) => {
    if (!preview && !hasPremium) {
      toast.error("Recurso premium. Assine um plano para resumos completos do livro com IA.");
      navigate("/pricing");
      return;
    }
    setGeneratingBookSummary(true);
    try {
      const invokeSummary = (text?: string) =>
        supabase.functions.invoke("summarize-book", {
          body: { book_id: id, preview, ...(text ? { text } : {}) },
        });

      let { data, error } = await invokeSummary();

      // Detect "needs client extraction" from either a normal response or an HTTP error body.
      let needsExtraction = data?.needsClientExtraction === true;
      if (error) {
        const ctx: any = (error as any).context;
        try {
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.clone().json();
            needsExtraction = body?.needsClientExtraction === true;
            if (!needsExtraction && body?.error) (error as any).message = body.error;
          } else if (ctx && typeof ctx.text === "function") {
            const txt = await ctx.clone().text();
            needsExtraction = txt.includes("needsClientExtraction");
          }
        } catch (_) { /* ignore */ }
      }

      if (needsExtraction) {
        toast.info("Extraindo texto do livro... isso pode levar alguns segundos.");
        const { data: book, error: bookError } = await supabase.from("books").select("file_path").eq("id", id!).single();
        if (bookError || !book?.file_path) {
          toast.error("Arquivo do livro não encontrado para extrair o texto.");
          return;
        }

        const { data: signed, error: signedError } = await supabase.storage.from("pdfs").createSignedUrl(book.file_path, 60 * 10);
        if (signedError || !signed?.signedUrl) {
          toast.error("Não foi possível abrir o PDF para extrair o texto.");
          return;
        }

        const pdfDoc = await pdfjs.getDocument(signed.signedUrl).promise;
        let allText = "";
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          allText += content.items.map((it: any) => it.str || "").join(" ") + "\n\n";
        }
        const cleanText = allText.replace(/\s+/g, " ").trim();
        if (cleanText.length >= 100) {
          ({ data, error } = await invokeSummary(cleanText));
        } else {
          toast.error("Não foi possível extrair texto do PDF (pode ser um PDF escaneado).");
          return;
        }
      }

      if (data?.needsClientExtraction) {
        toast.error("Não foi possível preparar o texto do livro para resumo.");
        return;
      }

      if (error) {
        if (error.message?.includes("429")) toast.error("Limite de requisições excedido. Tente novamente mais tarde.");
        else if (error.message?.includes("402")) toast.error("Créditos insuficientes.");
        else if (error.message?.includes("403") || error.message?.includes("premium")) {
          toast.error("Recurso premium. Assine um plano.");
          navigate("/pricing");
        } else toast.error("Erro ao gerar resumo do livro");
        console.error(error);
        return;
      }
      setBookSummary(data.summary);
      setBookSummaryIsPreview(data.isPreview || false);
      toast.success(preview ? "Preview do livro gerado!" : "Resumo completo do livro gerado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar resumo do livro");
    } finally {
      setGeneratingBookSummary(false);
    }
  };

  const generateSummary = async (preview: boolean = false) => {
    if (highlights.length === 0) {
      toast.error("Não há destaques para resumir");
      return;
    }

    // Preview é permitido para todos, resumo completo só para premium
    if (!preview && !hasPremium) {
      toast.error("Recurso premium. Assine um plano para gerar resumos completos com IA.");
      navigate("/pricing");
      return;
    }

    setGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-highlights", {
        body: { highlights, preview },
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast.error("Limite de requisições excedido. Tente novamente mais tarde.");
        } else if (error.message?.includes("402")) {
          toast.error("Créditos insuficientes. Adicione créditos ao seu workspace.");
        } else if (error.message?.includes("403") || error.message?.includes("premium")) {
          toast.error("Recurso premium. Assine um plano para gerar resumos com IA.");
          navigate("/pricing");
        } else {
          toast.error("Erro ao gerar resumo");
        }
        console.error("Erro:", error);
        return;
      }

      setSummary(data.summary);
      setIsPreview(data.isPreview || false);
      toast.success(preview ? "Preview gerado com sucesso!" : "Resumo gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar resumo:", error);
      toast.error("Erro ao gerar resumo");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const handleShare = () => {
    navigate(`/share/${id}`);
  };

  const exportSummaryToPDF = async () => {
    if (!summary) {
      toast.error("Nenhum resumo para exportar");
      return;
    }

    try {
      const { HighlightsPDFDocument } = await import("@/components/HighlightsPDFDocument");
      
      const doc = (
        <HighlightsPDFDocument
          bookTitle={`${bookTitle} - Resumo IA`}
          highlights={[]}
          notes={[{
            id: "summary",
            note_text: summary,
            page_number: 1,
            book_id: id!,
            user_id: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]}
          options={{
            includeHighlights: false,
            includeNotes: true,
            groupByPage: false,
            includeTimestamps: false,
            includeColors: false
          }}
        />
      );

      const blob = await pdf(doc).toBlob();
      saveAs(blob, `${bookTitle}-resumo-${Date.now()}.pdf`);
      toast.success("Resumo exportado para PDF!");
    } catch (error) {
      console.error("Erro ao exportar resumo:", error);
      toast.error("Erro ao exportar resumo");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 mb-8 aura-soft"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/reader/${id}`)}
              className="aura-soft transition-aura"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Resumo e Marcações
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {highlights.length} trechos destacados
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExport}
              className="aura-soft transition-aura"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="aura-soft transition-aura"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Full Book AI Summary Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mb-8"
      >
        <div className="glass rounded-xl p-6 border-l-4 border-accent">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              Resumo Completo do Livro (IA)
            </h2>
            {!bookSummary && (
              <div className="flex flex-col gap-2">
                {hasPremium ? (
                  <Button onClick={() => generateBookSummary(false)} disabled={generatingBookSummary} className="gap-2">
                    {generatingBookSummary ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Analisando livro...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" />Gerar Resumo Completo</>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => generateBookSummary(true)} disabled={generatingBookSummary} variant="outline" className="gap-2">
                      {generatingBookSummary ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</>
                      ) : (
                        <><Sparkles className="w-4 h-4" />Ver Preview Grátis</>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">Resumo completo do livro disponível no plano premium</p>
                  </>
                )}
              </div>
            )}
          </div>
          {bookSummary ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {bookSummaryIsPreview && (
                <div className="mb-4 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                  <p className="text-sm font-semibold text-accent mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4" />Preview Gratuito
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Este é um preview. Assine premium para o resumo completo com ideias principais, pontos importantes e lições.
                  </p>
                </div>
              )}
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">{bookSummary}</p>
              {bookSummaryIsPreview ? (
                <div className="mt-6 p-6 bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 rounded-lg text-center">
                  <h3 className="font-semibold mb-2">✨ Quer o resumo completo do livro?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Análise profunda com ideias principais, pontos mais importantes, lições e citações memoráveis.
                  </p>
                  <Button onClick={() => navigate("/pricing")} className="gap-2">
                    <Sparkles className="w-4 h-4" />Ver Planos Premium
                  </Button>
                </div>
              ) : (
                <Button onClick={() => generateBookSummary(false)} disabled={generatingBookSummary} variant="outline" size="sm" className="mt-4">
                  {generatingBookSummary ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" />Gerando...</>) : "Gerar Novamente"}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              A IA analisa o livro inteiro e destaca as <strong>partes mais importantes</strong>: ideias principais, pontos-chave, lições e citações memoráveis.
            </p>
          )}
        </div>
      </motion.div>

      {/* AI Summary Section */}
      {highlights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-8"
        >
          <div className="glass rounded-xl p-6 border-l-4 border-primary">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Resumo Inteligente
              </h2>
              {!summary && (
                <div className="flex flex-col gap-2">
                  {hasPremium ? (
                    <Button
                      onClick={() => generateSummary(false)}
                      disabled={generatingSummary}
                      className="gap-2"
                    >
                      {generatingSummary ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Gerar Resumo Completo
                        </>
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => generateSummary(true)}
                        disabled={generatingSummary}
                        variant="outline"
                        className="gap-2"
                      >
                        {generatingSummary ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Ver Preview Grátis (50 palavras)
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Experimente grátis! Resumo completo disponível no plano premium
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {summary ? (
              <div className="prose prose-sm max-w-none">
                {isPreview && (
                  <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Preview Gratuito (50 palavras)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Este é um preview limitado. Assine o plano premium para resumos completos e detalhados!
                    </p>
                  </div>
                )}
                
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
                
                {isPreview && (
                  <div className="mt-6 p-6 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg text-center">
                    <h3 className="font-semibold mb-2">✨ Quer o resumo completo?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Assine o plano premium e tenha acesso a resumos completos com até 300 palavras
                    </p>
                    <Button
                      onClick={() => navigate("/pricing")}
                      className="gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Ver Planos Premium
                    </Button>
                  </div>
                )}
                
                {!isPreview && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => generateSummary(false)}
                      disabled={generatingSummary}
                      variant="outline"
                      size="sm"
                    >
                      {generatingSummary ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Gerando...
                        </>
                      ) : (
                        "Gerar Novo Resumo"
                      )}
                    </Button>
                    <Button
                      onClick={exportSummaryToPDF}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <FileDown className="w-4 h-4" />
                      Exportar Resumo PDF
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Clique em "Gerar Resumo" para criar um resumo inteligente dos seus destaques usando IA
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Highlights list */}
      <div className="max-w-4xl mx-auto space-y-4">
        <h2 className="text-lg font-semibold mb-4">Seus Destaques</h2>
        {highlights.map((highlight, index) => (
          <motion.div
            key={highlight.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass rounded-xl p-6 border-l-4 hover:aura-soft transition-aura cursor-pointer"
            style={{ borderLeftColor: highlight.color }}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-muted-foreground">Página {highlight.page_number}</span>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: highlight.color }}
              />
            </div>
            {highlight.text ? (
              <div>
                <p className="text-foreground leading-relaxed mb-4">{highlight.text}</p>
                
                <HighlightImageDialog 
                  text={highlight.text} 
                  highlightId={highlight.id}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-2">
                      <Sparkles className="w-4 h-4" />
                      Gerar Imagem
                    </Button>
                  }
                />
              </div>
            ) : (
              <p className="text-muted-foreground italic text-sm">
                Destaque visual (sem texto extraído)
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {highlights.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-12 text-center max-w-2xl mx-auto"
        >
          <p className="text-muted-foreground">
            Você ainda não fez nenhuma marcação neste livro.
            <br />
            Comece destacando trechos importantes durante a leitura!
          </p>
        </motion.div>
      )}

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        bookTitle={bookTitle}
        highlights={highlights}
        notes={summary ? [{ 
          id: "summary", 
          note_text: summary, 
          page_number: 1,
          book_id: id!,
          user_id: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }] : []}
      />
    </div>
  );
};

export default Summary;
