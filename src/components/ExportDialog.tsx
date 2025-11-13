import { useState } from "react";
import { Download, FileText, File, Hash, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useExport, type ExportFormat } from "@/hooks/useExport";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Highlight } from "@/hooks/useHighlights";
import type { Note } from "@/hooks/useNotes";

interface ExportDialogProps {
  bookTitle: string;
  highlights: Highlight[];
  notes: Note[];
}

export const ExportDialog = ({ bookTitle, highlights, notes }: ExportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [includeHighlights, setIncludeHighlights] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [groupByPage, setGroupByPage] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeColors, setIncludeColors] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { exportData } = useExport();
  const { subscriptionTier } = useAuth();

  const handleExport = async () => {
    if (subscriptionTier !== 'premium' && subscriptionTier !== 'pro') {
      toast.error("Recurso de exportação disponível apenas para assinantes Premium");
      return;
    }

    setIsExporting(true);
    try {
      await exportData(format, bookTitle, highlights, notes, {
        includeHighlights,
        includeNotes,
        groupByPage,
        includeTimestamps,
        includeColors,
      });
      setOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  const formatIcons = {
    pdf: FileText,
    word: File,
    markdown: Hash,
    notion: FileText,
  };

  const formatLabels = {
    pdf: "PDF",
    word: "Word (.docx)",
    markdown: "Markdown (.md)",
    notion: "Notion (JSON)",
  };

  const formatDescriptions = {
    pdf: "Documento PDF formatado com visual profissional",
    word: "Documento editável do Microsoft Word",
    markdown: "Formato texto simples para desenvolvedores",
    notion: "Arquivo JSON para importar no Notion",
  };

  const Icon = formatIcons[format];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar Destaques e Anotações</DialogTitle>
          <DialogDescription>
            Escolha o formato e personalize sua exportação
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Formato</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as ExportFormat)}
              className="grid grid-cols-2 gap-3"
            >
              {(Object.keys(formatIcons) as ExportFormat[]).map((fmt) => {
                const FmtIcon = formatIcons[fmt];
                return (
                  <div key={fmt}>
                    <RadioGroupItem
                      value={fmt}
                      id={fmt}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={fmt}
                      className="flex flex-col gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-2">
                        <FmtIcon className="w-5 h-5" />
                        <span className="font-medium">{formatLabels[fmt]}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDescriptions[fmt]}
                      </span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Content Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Conteúdo</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="highlights"
                  checked={includeHighlights}
                  onCheckedChange={(checked) =>
                    setIncludeHighlights(checked as boolean)
                  }
                  disabled={highlights.length === 0}
                />
                <Label htmlFor="highlights" className="cursor-pointer">
                  Incluir Destaques ({highlights.length})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notes"
                  checked={includeNotes}
                  onCheckedChange={(checked) =>
                    setIncludeNotes(checked as boolean)
                  }
                  disabled={notes.length === 0}
                />
                <Label htmlFor="notes" className="cursor-pointer">
                  Incluir Anotações ({notes.length})
                </Label>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Opções de Formatação</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="groupByPage"
                  checked={groupByPage}
                  onCheckedChange={(checked) =>
                    setGroupByPage(checked as boolean)
                  }
                />
                <Label htmlFor="groupByPage" className="cursor-pointer">
                  Agrupar por página
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="timestamps"
                  checked={includeTimestamps}
                  onCheckedChange={(checked) =>
                    setIncludeTimestamps(checked as boolean)
                  }
                />
                <Label htmlFor="timestamps" className="cursor-pointer flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Incluir data e hora
                </Label>
              </div>
              {includeHighlights && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="colors"
                    checked={includeColors}
                    onCheckedChange={(checked) =>
                      setIncludeColors(checked as boolean)
                    }
                  />
                  <Label htmlFor="colors" className="cursor-pointer">
                    Incluir cores dos destaques
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Preview Info */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
            <div className="flex items-start gap-3">
              <Icon className="w-5 h-5 mt-0.5 text-primary" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium">Pré-visualização da Exportação</p>
                <p className="text-xs text-muted-foreground">
                  {includeHighlights && includeNotes
                    ? `${highlights.length} destaques e ${notes.length} anotações`
                    : includeHighlights
                    ? `${highlights.length} destaques`
                    : includeNotes
                    ? `${notes.length} anotações`
                    : "Nenhum conteúdo selecionado"}
                  {" • "}
                  {groupByPage ? "Agrupado por página" : "Lista contínua"}
                  {includeTimestamps && " • Com timestamps"}
                  {includeColors && includeHighlights && " • Com cores"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || (!includeHighlights && !includeNotes)}
            className="flex-1 gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Exportar {formatLabels[format]}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
