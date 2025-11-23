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
  isDrawMode?: boolean;
  onCancelDraw?: () => void;
  isQuickMode?: boolean;
  onToggleQuickMode?: () => void;
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
  isDrawMode = false,
  onCancelDraw,
  isQuickMode = false,
  onToggleQuickMode,
}: HighlightToolbarProps) => {
  return (
    <div className="glass rounded-lg p-2 flex items-center gap-2">
      {isDrawMode ? (
        <>
          <Button
            variant="destructive"
            size="sm"
            onClick={onCancelDraw}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            <span className="text-xs">Cancelar</span>
          </Button>
          <div className="px-3 py-1 bg-primary/10 rounded-md border border-primary/20 animate-pulse">
            <span className="text-xs font-medium text-primary">
              {isQuickMode ? "Modo Rápido: Toque para destacar múltiplas áreas" : "Toque na área para destacar"}
            </span>
          </div>
          {onToggleQuickMode && (
            <Button
              variant={isQuickMode ? "default" : "outline"}
              size="sm"
              onClick={onToggleQuickMode}
              className="gap-2"
            >
              <Highlighter className="w-4 h-4" />
              <span className="text-xs">{isQuickMode ? "Modo Rápido ON" : "Modo Único"}</span>
            </Button>
          )}
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onHighlight}
            className="gap-2 aura-soft"
          >
            <Highlighter className="w-4 h-4" />
            <span className="text-xs">Destacar</span>
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 aura-soft"
              >
                <div 
                  className="w-6 h-6 rounded border-2 border-border shadow-sm"
                  style={{ backgroundColor: selectedColor }}
                  title="Trocar cor"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="glass w-64" align="start">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-3">Escolha a cor do destaque</p>
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
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
};
