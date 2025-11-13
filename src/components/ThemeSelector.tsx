import { motion } from "framer-motion";
import { Palette, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTheme, ThemeType } from "@/contexts/ThemeContext";

interface Theme {
  id: ThemeType;
  name: string;
  description: string;
  preview: {
    bg: string;
    text: string;
    accent: string;
  };
}

const THEMES: Theme[] = [
  {
    id: "safira",
    name: "Safira",
    description: "Tema padrão com azul safira",
    preview: {
      bg: "bg-[hsl(220,15%,8%)]",
      text: "bg-[hsl(210,20%,98%)]",
      accent: "bg-[hsl(210,100%,60%)]",
    },
  },
  {
    id: "sepia",
    name: "Sépia",
    description: "Tom vintage e confortável",
    preview: {
      bg: "bg-[hsl(35,30%,85%)]",
      text: "bg-[hsl(30,20%,20%)]",
      accent: "bg-[hsl(30,60%,45%)]",
    },
  },
  {
    id: "noturno",
    name: "Noturno",
    description: "Preto puro para leitura noturna",
    preview: {
      bg: "bg-[hsl(0,0%,0%)]",
      text: "bg-[hsl(0,0%,85%)]",
      accent: "bg-[hsl(210,100%,55%)]",
    },
  },
  {
    id: "contraste",
    name: "Alto Contraste",
    description: "Máximo contraste para acessibilidade",
    preview: {
      bg: "bg-[hsl(0,0%,100%)]",
      text: "bg-[hsl(0,0%,0%)]",
      accent: "bg-[hsl(210,100%,40%)]",
    },
  },
];

export const ThemeSelector = () => {
  const { theme, setTheme, isLoading } = useTheme();

  if (isLoading) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="aura-soft transition-aura"
          title="Selecionar tema"
        >
          <Palette className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass w-72">
        <div className="p-2">
          <p className="text-sm font-semibold mb-3 px-2">Escolha seu tema</p>
          <div className="space-y-2">
            {THEMES.map((themeOption) => (
              <DropdownMenuItem
                key={themeOption.id}
                onClick={() => setTheme(themeOption.id)}
                className="cursor-pointer p-3 rounded-lg"
              >
                <div className="flex items-center gap-3 w-full">
                  {/* Theme Preview */}
                  <div className="flex gap-1">
                    <div className={`w-6 h-10 rounded ${themeOption.preview.bg} border border-border`} />
                    <div className="flex flex-col gap-1">
                      <div className={`w-4 h-4 rounded ${themeOption.preview.text}`} />
                      <div className={`w-4 h-4 rounded ${themeOption.preview.accent}`} />
                    </div>
                  </div>

                  {/* Theme Info */}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{themeOption.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {themeOption.description}
                    </p>
                  </div>

                  {/* Check Icon */}
                  {theme === themeOption.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-primary"
                    >
                      <Check className="w-5 h-5" />
                    </motion.div>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
