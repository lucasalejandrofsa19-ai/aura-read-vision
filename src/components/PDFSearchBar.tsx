import { useState } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface PDFSearchBarProps {
  onSearch: (term: string) => void;
  onNextResult: () => void;
  onPrevResult: () => void;
  onClear: () => void;
  currentResultIndex: number;
  totalResults: number;
  isSearching: boolean;
}

export const PDFSearchBar = ({
  onSearch,
  onNextResult,
  onPrevResult,
  onClear,
  currentResultIndex,
  totalResults,
  isSearching,
}: PDFSearchBarProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value.length >= 2) {
      onSearch(value);
    } else if (value.length === 0) {
      onClear();
    }
  };

  const handleClear = () => {
    setSearchTerm("");
    onClear();
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="aura-soft transition-aura"
        title="Buscar no PDF (Ctrl+F)"
      >
        <Search className="w-5 h-5" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-12 glass p-3 rounded-lg border border-border/50 shadow-lg z-50 min-w-[320px]"
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar no documento..."
                  className="pl-9 pr-9 bg-background/50"
                  autoFocus
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={handleClear}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {totalResults > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {currentResultIndex + 1}/{totalResults}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPrevResult}
                    disabled={totalResults === 0}
                    className="h-8 w-8"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNextResult}
                    disabled={totalResults === 0}
                    className="h-8 w-8"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {isSearching && (
              <div className="mt-2 text-xs text-muted-foreground">
                Buscando...
              </div>
            )}

            {!isSearching && searchTerm.length >= 2 && totalResults === 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Nenhum resultado encontrado
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
