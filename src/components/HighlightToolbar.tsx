import { Button } from "@/components/ui/button";
import { Highlighter, Trash2, Pen, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface HighlightToolbarProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  onHighlight: () => void;
  isHighlightMode: boolean;
  selectedText: string;
  isDrawMode?: boolean;
  onCancelDraw?: () => void;
}

const HIGHLIGHT_COLORS = [
  { name: "Amarelo", value: "#fef08a", class: "bg-yellow-200" },
  { name: "Verde", value: "#bbf7d0", class: "bg-green-200" },
  { name: "Azul", value: "#bfdbfe", class: "bg-blue-200" },
  { name: "Rosa", value: "#fbcfe8", class: "bg-pink-200" },
  { name: "Roxo", value: "#e9d5ff", class: "bg-purple-200" },
  { name: "Laranja", value: "#fed7aa", class: "bg-orange-200" },
];

export const HighlightToolbar = ({
  selectedColor,
  onColorChange,
  onHighlight,
  isHighlightMode,
  selectedText,
  isDrawMode = false,
  onCancelDraw,
}: HighlightToolbarProps) => {
  return (
    <div className="glass rounded-lg p-2 flex items-center gap-2">
      {isDrawMode && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onCancelDraw}
          className="gap-2 animate-pulse"
        >
          <X className="w-4 h-4" />
          <span className="text-xs">Cancelar Desenho</span>
        </Button>
      )}
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-2 ${isHighlightMode ? "aura-amber text-accent" : "aura-soft"}`}
          >
            <div className="flex items-center gap-2">
              <Highlighter className="w-4 h-4" />
              <span className="text-xs">Destacar</span>
              <div 
                className="w-4 h-4 rounded border-2 border-border"
                style={{ backgroundColor: selectedColor }}
                title="Cor atual"
              />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="glass w-64" align="start">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                Escolha a cor
                <span className="text-xs text-muted-foreground">(cores variadas)</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => onColorChange(color.value)}
                    className={`${color.class} h-12 rounded-md border-2 transition-all hover:scale-105 relative ${
                      selectedColor === color.value
                        ? "border-primary ring-2 ring-primary ring-offset-2 shadow-lg"
                        : "border-border"
                    }`}
                    title={color.name}
                  >
                    {selectedColor === color.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Highlighter className="w-5 h-5 text-primary drop-shadow-md" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {selectedText && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Texto selecionado:
                </p>
                <div className="p-2 bg-muted rounded text-xs max-h-20 overflow-auto">
                  {selectedText.substring(0, 100)}
                  {selectedText.length > 100 && "..."}
                </div>
                <Button
                  onClick={onHighlight}
                  className="w-full mt-2"
                  size="sm"
                  style={{ backgroundColor: selectedColor }}
                >
                  <Highlighter className="w-3 h-3 mr-2" />
                  Adicionar Destaque
                </Button>
              </div>
            )}

            {!selectedText && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center py-2">
                  Selecione um texto no PDF para destacar
                </p>
                <Button
                  onClick={onHighlight}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <Pen className="w-3 h-3 mr-2" />
                  Desenhar Destaque
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
