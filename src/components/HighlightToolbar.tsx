import { Button } from "@/components/ui/button";
import { Highlighter, Trash2, Pen, X, Crown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useUserData } from "@/hooks/useUserData";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
  const { hasPremiumAccess } = useUserData();
  const navigate = useNavigate();

  const handleColorChange = (color: string) => {
    // Amarelo é grátis, outras cores requerem premium
    if (color !== "#fef08a" && !hasPremiumAccess) {
      toast.error("Cores personalizadas disponíveis apenas para assinantes Premium/Pro", {
        action: {
          label: "Ver Planos",
          onClick: () => navigate("/pricing"),
        },
      });
      return;
    }
    onColorChange(color);
  };

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
                    {HIGHLIGHT_COLORS.map((color, index) => {
                      const isPremiumColor = color.value !== "#fef08a";
                      const isLocked = isPremiumColor && !hasPremiumAccess;
                      
                      return (
                        <button
                          key={color.value}
                          onClick={() => handleColorChange(color.value)}
                          disabled={isLocked}
                          className={`${color.class} h-12 rounded-md border-2 transition-all hover:scale-105 relative ${
                            selectedColor === color.value
                              ? "border-primary ring-2 ring-primary ring-offset-2 shadow-lg"
                              : "border-border"
                          } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                          title={isLocked ? `${color.name} (Premium/Pro)` : color.name}
                        >
                          {selectedColor === color.value && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Highlighter className="w-5 h-5 text-primary drop-shadow-md" />
                            </div>
                          )}
                          {isLocked && (
                            <div className="absolute top-0 right-0 -mt-1 -mr-1">
                              <Badge className="h-4 w-4 p-0 flex items-center justify-center bg-gradient-to-r from-purple-500 to-purple-700 border-0">
                                <Crown className="w-2.5 h-2.5 text-white" />
                              </Badge>
                            </div>
                          )}
                        </button>
                      );
                    })}
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
