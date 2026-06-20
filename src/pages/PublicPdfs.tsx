import { Download, FileText, ArrowLeft, Plus, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { PUBLIC_PDFS, formatBytes, type PublicPdf } from "@/lib/publicPdfs";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { captureError } from "@/lib/sentry";

const sanitizeFileName = (name: string) => {
  const base = name.replace(/\.pdf$/i, "");
  const clean = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "documento";
  return `${clean}.pdf`;
};

const PublicPdfs = () => {
  const { user } = useAuth();
  const { hasPremiumAccess, isAdmin } = useUserData();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [importingId, setImportingId] = useState<string | null>(null);

  const handleAddToLibrary = async (pdf: PublicPdf) => {
    if (!user) {
      toast.error("Faça login para adicionar à sua biblioteca.");
      return;
    }
    setImportingId(pdf.id);
    try {
      // Check quota
      const { count } = await supabase
        .from("books")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      const maxBooks = isAdmin || hasPremiumAccess ? 1000 : 5;
      if ((count || 0) >= maxBooks) {
        toast.error(
          hasPremiumAccess || isAdmin
            ? `Limite de ${maxBooks} livros atingido.`
            : `Limite gratuito (${maxBooks} livros). Faça upgrade para Premium.`
        );
        return;
      }

      toast.loading("Baixando PDF…", { id: `import-${pdf.id}` });
      const res = await fetch(pdf.url);
      if (!res.ok) throw new Error(`Falha ao baixar (${res.status})`);
      const blob = await res.blob();

      if (blob.size > 52428800) {
        toast.error("PDF maior que 50MB.", { id: `import-${pdf.id}` });
        return;
      }

      toast.loading("Enviando para sua biblioteca…", { id: `import-${pdf.id}` });
      const safeName = sanitizeFileName(pdf.filename || `${pdf.title}.pdf`);
      const filePath = `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(filePath, blob, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      const colors = [
        "from-blue-500 to-blue-700",
        "from-amber-500 to-amber-700",
        "from-purple-500 to-purple-700",
        "from-green-500 to-green-700",
      ];
      const { error: insertError } = await supabase.from("books").insert({
        user_id: user.id,
        title: pdf.title,
        file_path: filePath,
        file_size: blob.size,
        cover_color: colors[Math.floor(Math.random() * colors.length)],
      });
      if (insertError) {
        await supabase.storage.from("pdfs").remove([filePath]).catch(() => {});
        throw insertError;
      }

      queryClient.invalidateQueries({ queryKey: ["books", user.id] });
      toast.success("Adicionado à sua biblioteca!", {
        id: `import-${pdf.id}`,
        action: { label: "Abrir", onClick: () => navigate("/library") },
      });
    } catch (error: any) {
      captureError(error, { context: "public_pdf_import" });
      toast.error(error?.message || "Não foi possível adicionar.", { id: `import-${pdf.id}` });
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="PDFs Públicos — Biblioteca Gratuita | AuraRead"
        description="Adicione PDFs públicos diretamente à sua biblioteca AuraRead com um clique."
        path="/pdfs-publicos"
      />

      <div className="container max-w-5xl mx-auto px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">PDFs Públicos</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Adicione diretamente à sua biblioteca para ler dentro do AuraRead, com marcações, áudio e resumos.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {PUBLIC_PDFS.map((pdf) => {
            const isImporting = importingId === pdf.id;
            return (
              <Card key={pdf.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg leading-tight">{pdf.title}</CardTitle>
                      {pdf.author && <CardDescription className="mt-1">{pdf.author}</CardDescription>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between gap-4">
                  {pdf.description && (
                    <p className="text-sm text-muted-foreground">{pdf.description}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{formatBytes(pdf.sizeBytes)}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        disabled={isImporting}
                      >
                        <a href={pdf.url} download={pdf.filename} target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4 mr-1" />
                          Baixar
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAddToLibrary(pdf)}
                        disabled={isImporting || !user}
                        title={!user ? "Faça login para adicionar" : undefined}
                      >
                        {isImporting ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-1" />
                        )}
                        Adicionar à biblioteca
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </div>
  );
};

export default PublicPdfs;
