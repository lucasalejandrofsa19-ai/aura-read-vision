import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { exportHighlightsPDF } from "@/lib/pdfExport";
import { toast } from "sonner";

const LOREMS = [
  "A leitura amplia horizontes e renova perspectivas sobre o mundo ao redor.",
  "Cada página virada é um pequeno passo rumo a uma compreensão mais profunda.",
  "Os destaques preservam o que mais importou em cada momento da jornada.",
  "Pensamento crítico nasce do contato constante com ideias bem articuladas.",
  "Anotações transformam o leitor passivo em interlocutor ativo do texto.",
];
const COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"];

const makeFakeHighlights = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `fake-${i + 1}`,
    page_number: Math.floor(i / 3) + 1,
    text: `[#${i + 1}] ${LOREMS[i % LOREMS.length]}`,
    color: COLORS[i % COLORS.length],
    created_at: new Date(Date.now() - i * 60_000).toISOString(),
  }));

const DevExportTest = () => {
  const [busy, setBusy] = useState<number | null>(null);

  const run = async (n: number) => {
    setBusy(n);
    try {
      const hi = makeFakeHighlights(n);
      exportHighlightsPDF(`Teste ${n} destaques`, hi, [], {
        includeHighlights: true,
        includeNotes: false,
        groupByPage: false,
        includeTimestamps: true,
        includeColors: true,
      });
      toast.success(`PDF gerado com ${n} destaques`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDF");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="container mx-auto max-w-2xl py-12">
      <Card className="p-8 space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Modo de teste · Exportação de destaques</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Gera destaques fictícios e dispara o download do PDF para validar a paginação
            "Destaques — Página X de Y" (60 destaques por página).
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          {[60, 120, 180].map((n) => (
            <Button
              key={n}
              onClick={() => run(n)}
              disabled={busy !== null}
              variant={n === 60 ? "outline" : "default"}
            >
              {busy === n ? "Gerando…" : `Exportar ${n}`}
            </Button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Esperado: 60 → 1 bloco · 120 → 2 blocos ("1 de 2", "2 de 2") · 180 → 3 blocos.
        </p>
      </Card>
    </main>
  );
};

export default DevExportTest;
