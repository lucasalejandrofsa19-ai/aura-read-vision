import { useState } from "react";
import { Download, FileText, File, Hash, Calendar, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { useExport, type ExportFormat } from "@/hooks/useExport";
import { usePremiumValidation } from "@/hooks/usePremiumValidation";
import { useUserData } from "@/hooks/useUserData";
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Note } from "@/hooks/useNotes";

interface Highlight {
  id: string;
  page_number: number;
  text: string;
  color: string | null;
  created_at: string;
}

interface ExportDialogProps {
  bookTitle: string;
  highlights: Highlight[];
  notes: Note[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ExportDialog = ({ bookTitle, highlights, notes, open: controlledOpen, onOpenChange }: ExportDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPremiumAccess } = useUserData();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [includeHighlights, setIncludeHighlights] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [groupByPage, setGroupByPage] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeColors, setIncludeColors] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { exportData } = useExport();
  const { validatePremiumAccess } = usePremiumValidation();

  const isPremiumFormat = (fmt: ExportFormat) => {
    return ["word", "notion"].includes(fmt);
  };

  const handleExport = async () => {
    if (!user) {
      toast.error("Faça login para exportar");
      return;
    }

    if (!includeHighlights && !includeNotes) {
      toast.error("Selecione pelo menos uma opção para exportar");
      return;
    }

    // Check premium access for advanced export formats
    const advancedFormats = ["word", "notion"];
    
    if (advancedFormats.includes(format)) {
      // Server-side validation with rate limiting
      const { hasPremiumAccess, rateLimitReached } = await validatePremiumAccess();

      if (rateLimitReached) {
        return; // Toast already shown by hook
      }

        if (!hasPremiumAccess) {
          toast.error("Recurso disponível apenas para assinantes Premium/Pro", {
            action: {
              label: "Ver Planos",
              onClick: () => navigate("/pricing"),
            },
          });
          return;
        }

      // Audit log for successful access
      await supabase.from('premium_access_audit').insert({
        user_id: user.id,
        action: 'access_granted',
        feature: `export_${format}`,
        granted: true,
        reason: 'premium_access_verified',
        metadata: { format, bookTitle },
      });
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
      
      toast.success("Exportação realizada com sucesso!");
      setOpen(false);
    } catch (error) {
      captureError(error, { context: "export_highlights" });
      if (import.meta.env.DEV) {
        console.error('Export error:', error);
      }
      toast.error("Erro ao exportar dados");
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
                const isPremium = isPremiumFormat(fmt);
                const isLocked = isPremium && !hasPremiumAccess;
                
                return (
                  <div key={fmt} className="relative">
                    <RadioGroupItem
                      value={fmt}
                      id={fmt}
                      className="peer sr-only"
                      disabled={isLocked}
                    />
                    <Label
                      htmlFor={fmt}
                      className={`flex flex-col gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-accent/50 ${
                        isLocked ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <FmtIcon className="w-5 h-5" />
                          <span className="font-medium">{formatLabels[fmt]}</span>
                        </div>
                        {isPremium && (
                          <Badge className="h-5 px-1.5 flex items-center gap-1 bg-gradient-to-r from-purple-500 to-purple-700 border-0">
                            <Crown className="w-3 h-3 text-white" />
                            <span className="text-[10px] text-white">PRO</span>
                          </Badge>
                        )}
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
