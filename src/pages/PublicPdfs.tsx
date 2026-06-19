import { Download, FileText, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { PUBLIC_PDFS, formatBytes } from "@/lib/publicPdfs";

const PublicPdfs = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="PDFs Públicos — Biblioteca Gratuita | AuraRead"
        description="Baixe gratuitamente PDFs públicos disponíveis para qualquer usuário, sem necessidade de cadastro."
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
            Biblioteca de PDFs gratuitos, hospedados na nuvem e disponíveis para download por qualquer usuário.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {PUBLIC_PDFS.map((pdf) => (
            <Card key={pdf.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg leading-tight">{pdf.title}</CardTitle>
                    {pdf.author && (
                      <CardDescription className="mt-1">{pdf.author}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-4">
                {pdf.description && (
                  <p className="text-sm text-muted-foreground">{pdf.description}</p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{formatBytes(pdf.sizeBytes)}</span>
                  <Button asChild size="sm" className="gap-2">
                    <a href={pdf.url} download={pdf.filename} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4" />
                      Baixar
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
};

export default PublicPdfs;
