import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, ChevronDown, ChevronUp, Highlighter } from "lucide-react";
import { Highlight } from "@/hooks/useHighlights";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HighlightsListProps {
  highlights: Highlight[];
  onDelete: (id: string) => void;
  onNavigate: (pageNumber: number) => void;
}

export const HighlightsList = ({
  highlights,
  onDelete,
  onNavigate,
}: HighlightsListProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (highlights.length === 0) {
    return (
      <div className="glass rounded-lg p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Highlighter className="w-4 h-4" />
          <p className="text-sm">Nenhum destaque ainda</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Highlighter className="w-4 h-4 text-accent" />
          <span className="font-medium text-sm">
            Meus Destaques ({highlights.length})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ScrollArea className="max-h-96 border-t border-border">
              <div className="p-4 space-y-3">
                {highlights.map((highlight) => (
                  <motion.div
                    key={highlight.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors group"
                    style={{
                      borderLeftWidth: "4px",
                      borderLeftColor: highlight.color,
                    }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <button
                        onClick={() => onNavigate(highlight.page_number)}
                        className="flex-1 text-left"
                      >
                        <p className="text-sm mb-1 line-clamp-3">
                          {highlight.text}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Página {highlight.page_number}</span>
                          <span>•</span>
                          <span>
                            {format(
                              new Date(highlight.created_at),
                              "dd/MM/yyyy",
                              { locale: ptBR }
                            )}
                          </span>
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(highlight.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
