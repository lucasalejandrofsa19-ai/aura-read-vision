import { Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface Highlight {
  id: string;
  page_number: number;
  text: string;
  color: string;
  created_at: string;
}

interface HighlightsListProps {
  highlights: Highlight[];
  onDelete: (id: string) => void;
  onNavigate: (pageNumber: number) => void;
  currentPage: number;
}

export const HighlightsList = ({
  highlights,
  onDelete,
  onNavigate,
  currentPage,
}: HighlightsListProps) => {
  if (highlights.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhum destaque ainda</p>
        <p className="text-sm mt-2">Use o modo marca-texto para criar destaques</p>
      </div>
    );
  }

  const sortedHighlights = [...highlights].sort((a, b) => a.page_number - b.page_number);

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {sortedHighlights.map((highlight) => (
          <div
            key={highlight.id}
            className={`p-3 rounded-lg border transition-colors ${
              currentPage === highlight.page_number
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>Página {highlight.page_number}</span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onNavigate(highlight.page_number)}
                  title="Ir para página"
                >
                  <MapPin className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onDelete(highlight.id)}
                  title="Deletar destaque"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm line-clamp-3 mb-2">{highlight.text}</p>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: highlight.color }}
              />
              <span className="text-xs text-muted-foreground">
                {format(new Date(highlight.created_at), "dd/MM/yyyy HH:mm")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
