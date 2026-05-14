import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Loader2, Copy, FileDown, GraduationCap, Quote, BookMarked, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePremiumValidation } from "@/hooks/usePremiumValidation";
import { z } from "zod";

const inputSchema = z.object({
  text: z.string().trim().min(50, "O texto precisa ter ao menos 50 caracteres").max(100000, "Máximo de 100.000 caracteres"),
  author: z.string().trim().max(300).optional().or(z.literal("")),
  title: z.string().trim().max(500).optional().or(z.literal("")),
  year: z.string().trim().max(10).optional().or(z.literal("")),
  publisher: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  url: z.string().trim().max(500).optional().or(z.literal("")),
  accessedAt: z.string().trim().max(20).optional().or(z.literal("")),
  journal: z.string().trim().max(300).optional().or(z.literal("")),
  volume: z.string().trim().max(20).optional().or(z.literal("")),
  issue: z.string().trim().max(20).optional().or(z.literal("")),
  pages: z.string().trim().max(40).optional().or(z.literal("")),
  doi: z.string().trim().max(200).optional().or(z.literal("")),
});

type Result = {
  summary?: string;
  keyPoints?: string[];
  directQuotes?: { quote: string; page?: string; citation?: string }[];
  inTextCitations?: string[];
  reference?: string;
  keywords?: string[];
  isPreview?: boolean;
  style?: string;
};

const AcademicSummary = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { validatePremiumAccess } = usePremiumValidation();
  const [hasPremium, setHasPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const [text, setText] = useState("");
  const [style, setStyle] = useState("ABNT");
  const [sourceType, setSourceType] = useState("book");
  const [summaryLength, setSummaryLength] = useState("medio");
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [publisher, setPublisher] = useState("");
  const [city, setCity] = useState("");
  const [url, setUrl] = useState("");
  const [accessedAt, setAccessedAt] = useState("");
  const [journal, setJournal] = useState("");
  const [volume, setVolume] = useState("");
  const [issue, setIssue] = useState("");
  const [pages, setPages] = useState("");
  const [doi, setDoi] = useState("");

  useEffect(() => {
    (async () => {
      if (!user) return;
      const r = await validatePremiumAccess();
      setHasPremium(r.hasPremiumAccess);
    })();
  }, [user]);

  const handleGenerate = async (preview: boolean) => {
    const validation = inputSchema.safeParse({
      text, author, title, year, publisher, city, url, accessedAt, journal, volume, issue, pages, doi,
    });
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }
    if (!preview && !hasPremium) {
      toast.error("Recurso premium. Assine um plano para resumos acadêmicos completos.");
      navigate("/pricing");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("academic-summary", {
        body: {
          text, style, sourceType, summaryLength, preview,
          author, title, year, publisher, city, url, accessedAt,
          journal, volume, issue, pages, doi,
        },
      });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("429")) toast.error("Limite excedido. Tente novamente mais tarde.");
        else if (msg.includes("402")) toast.error("Créditos insuficientes.");
        else if (msg.includes("403") || msg.includes("premium")) {
          toast.error("Recurso premium.");
          navigate("/pricing");
        } else toast.error("Erro ao gerar resumo acadêmico");
        return;
      }
      setResult(data);
      toast.success(preview ? "Preview gerado!" : "Resumo acadêmico gerado!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar resumo");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copiado!`);
  };

  const exportTxt = () => {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`RESUMO ACADÊMICO (${result.style || style})`);
    lines.push("=".repeat(60));
    if (result.summary) { lines.push("\n## Resumo\n", result.summary); }
    if (result.keyPoints?.length) { lines.push("\n## Pontos-chave"); result.keyPoints.forEach((p, i) => lines.push(`${i + 1}. ${p}`)); }
    if (result.directQuotes?.length) {
      lines.push("\n## Citações Diretas");
      result.directQuotes.forEach((q) => lines.push(`"${q.quote}"${q.page ? ` (p. ${q.page})` : ""}\n${q.citation || ""}`));
    }
    if (result.inTextCitations?.length) { lines.push("\n## Citações no Texto"); result.inTextCitations.forEach((c) => lines.push(`- ${c}`)); }
    if (result.reference) { lines.push("\n## Referência"); lines.push(result.reference); }
    if (result.keywords?.length) { lines.push("\n## Palavras-chave"); lines.push(result.keywords.join(", ")); }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `resumo-academico-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
    <SEO
      title="Resumo Acadêmico — AURA READ"
      description="Gere resumos acadêmicos detalhados de PDFs com IA na AURA READ."
      path="/resumo-academico"
    />
    <div className="min-h-screen p-4 md:p-6">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 mb-6 max-w-5xl mx-auto"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/library")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Resumo Acadêmico</h1>
                <p className="text-xs text-muted-foreground">Citações e referências em ABNT, APA, MLA, Vancouver e Chicago</p>
              </div>
            </div>
          </div>
          {!hasPremium && (
            <Badge variant="outline" className="gap-1">
              <Lock className="w-3 h-3" /> Premium
            </Badge>
          )}
        </div>
      </motion.header>

      <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-2">
        {/* Input form */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-lg">1. Texto e metadados da fonte</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Norma</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABNT">ABNT</SelectItem>
                  <SelectItem value="APA">APA</SelectItem>
                  <SelectItem value="MLA">MLA</SelectItem>
                  <SelectItem value="Vancouver">Vancouver</SelectItem>
                  <SelectItem value="Chicago">Chicago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo de fonte</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="book">Livro</SelectItem>
                  <SelectItem value="article">Artigo científico</SelectItem>
                  <SelectItem value="journal">Periódico</SelectItem>
                  <SelectItem value="website">Site</SelectItem>
                  <SelectItem value="thesis">Tese / Dissertação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Texto acadêmico</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui o texto, capítulo ou artigo que deseja resumir..."
              rows={8}
              maxLength={100000}
            />
            <p className="text-xs text-muted-foreground">{text.length.toLocaleString()} / 100.000 caracteres</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Autor(es)</Label>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Sobrenome, Nome" maxLength={300} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} />
            </div>
            <div className="space-y-1">
              <Label>Ano</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label>Páginas</Label>
              <Input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="ex: 12-30" maxLength={40} />
            </div>

            {(sourceType === "book" || sourceType === "thesis") && (
              <>
                <div className="space-y-1">
                  <Label>Editora</Label>
                  <Input value={publisher} onChange={(e) => setPublisher(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1">
                  <Label>Cidade</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
                </div>
              </>
            )}

            {(sourceType === "article" || sourceType === "journal") && (
              <>
                <div className="space-y-1 col-span-2">
                  <Label>Periódico</Label>
                  <Input value={journal} onChange={(e) => setJournal(e.target.value)} maxLength={300} />
                </div>
                <div className="space-y-1">
                  <Label>Volume</Label>
                  <Input value={volume} onChange={(e) => setVolume(e.target.value)} maxLength={20} />
                </div>
                <div className="space-y-1">
                  <Label>Número</Label>
                  <Input value={issue} onChange={(e) => setIssue(e.target.value)} maxLength={20} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>DOI</Label>
                  <Input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.xxxx/yyyy" maxLength={200} />
                </div>
              </>
            )}

            {sourceType === "website" && (
              <>
                <div className="space-y-1 col-span-2">
                  <Label>URL</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Data de acesso</Label>
                  <Input value={accessedAt} onChange={(e) => setAccessedAt(e.target.value)} placeholder="DD/MM/AAAA" maxLength={20} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-1">
            <Label>Tamanho do resumo</Label>
            <Select value={summaryLength} onValueChange={setSummaryLength}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="curto">Curto (~200 palavras)</SelectItem>
                <SelectItem value="medio">Médio (~400 palavras)</SelectItem>
                <SelectItem value="longo">Longo (~800 palavras)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            {hasPremium ? (
              <Button onClick={() => handleGenerate(false)} disabled={loading} className="gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</> : <><Sparkles className="w-4 h-4" />Gerar Resumo Acadêmico</>}
              </Button>
            ) : (
              <>
                <Button onClick={() => handleGenerate(true)} disabled={loading} variant="outline" className="gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</> : <><Sparkles className="w-4 h-4" />Ver Preview Grátis</>}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Resumo completo, citações e referência disponíveis no plano premium.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Result */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">2. Resultado</h2>
            {result && !result.isPreview && (
              <Button variant="outline" size="sm" onClick={exportTxt} className="gap-2">
                <FileDown className="w-4 h-4" /> Exportar
              </Button>
            )}
          </div>

          {!result && (
            <div className="text-center text-muted-foreground py-12">
              <BookMarked className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Preencha os dados e gere seu resumo com citações e referência formatadas.</p>
            </div>
          )}

          {result && (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Resumo</TabsTrigger>
                <TabsTrigger value="quotes">Citações</TabsTrigger>
                <TabsTrigger value="reference">Referência</TabsTrigger>
                <TabsTrigger value="key">Pontos</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-3 mt-4">
                {result.isPreview && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    Preview gratuito. Assine premium para resumo completo com citações e referência.
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.summary}</p>
                {result.summary && (
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.summary!, "Resumo")} className="gap-2">
                    <Copy className="w-4 h-4" /> Copiar
                  </Button>
                )}
                {result.keywords?.length ? (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {result.keywords.map((k, i) => (
                      <Badge key={i} variant="secondary">{k}</Badge>
                    ))}
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="quotes" className="space-y-4 mt-4">
                {result.directQuotes?.length ? (
                  result.directQuotes.map((q, i) => (
                    <div key={i} className="border-l-4 border-primary/40 pl-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Quote className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                        <p className="text-sm italic">"{q.quote}"</p>
                      </div>
                      {q.citation && (
                        <div className="flex items-center justify-between gap-2 bg-muted/50 rounded p-2">
                          <code className="text-xs">{q.citation}</code>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(q.citation!, "Citação")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma citação direta disponível {result.isPreview ? "no preview" : ""}.</p>
                )}

                {result.inTextCitations?.length ? (
                  <div className="pt-3 border-t">
                    <h3 className="text-sm font-semibold mb-2">Citações no texto</h3>
                    <ul className="space-y-1">
                      {result.inTextCitations.map((c, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 bg-muted/50 rounded p-2">
                          <code className="text-xs">{c}</code>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(c, "Citação")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="reference" className="mt-4">
                {result.reference ? (
                  <div className="space-y-3">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm font-mono leading-relaxed">{result.reference}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(result.reference!, "Referência")} className="gap-2">
                      <Copy className="w-4 h-4" /> Copiar referência ({result.style})
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Referência disponível apenas no resumo completo (premium).
                  </p>
                )}
              </TabsContent>

              <TabsContent value="key" className="mt-4">
                {result.keyPoints?.length ? (
                  <ol className="space-y-2 list-decimal pl-5">
                    {result.keyPoints.map((p, i) => (
                      <li key={i} className="text-sm leading-relaxed">{p}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum ponto-chave disponível.</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default AcademicSummary;
