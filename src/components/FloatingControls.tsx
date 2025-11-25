import { useState, useCallback, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  Bookmark,
  BookmarkCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onBookmark: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSearch: () => void;
  isBookmarked: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  currentPage: number;
  totalPages: number;
}

export const FloatingControls = ({
  onZoomIn,
  onZoomOut,
  onBookmark,
  onPrevPage,
  onNextPage,
  onSearch,
  isBookmarked,
  canZoomIn,
  canZoomOut,
  canGoPrev,
  canGoNext,
  currentPage,
  totalPages,
}: FloatingControlsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleMenu = () => setIsOpen(!isOpen);

  // Debounced zoom handlers to prevent multiple rapid calls
  const handleZoomIn = useCallback(() => {
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
    zoomTimeoutRef.current = setTimeout(() => {
      onZoomIn();
    }, 100);
  }, [onZoomIn]);

  const handleZoomOut = useCallback(() => {
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
    zoomTimeoutRef.current = setTimeout(() => {
      onZoomOut();
    }, 100);
  }, [onZoomOut]);

  const menuItems = [
    {
      icon: ZoomIn,
      label: "Aumentar",
      onClick: handleZoomIn,
      disabled: !canZoomIn,
    },
    {
      icon: ZoomOut,
      label: "Diminuir",
      onClick: handleZoomOut,
      disabled: !canZoomOut,
    },
    {
      icon: isBookmarked ? BookmarkCheck : Bookmark,
      label: isBookmarked ? "Marcado" : "Marcar",
      onClick: onBookmark,
      disabled: false,
      highlight: isBookmarked,
    },
    {
      icon: Search,
      label: "Buscar",
      onClick: onSearch,
      disabled: false,
    },
    {
      icon: ChevronLeft,
      label: "Anterior",
      onClick: onPrevPage,
      disabled: !canGoPrev,
    },
    {
      icon: ChevronRight,
      label: "Próxima",
      onClick: onNextPage,
      disabled: !canGoNext,
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={toggleMenu}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] md:hidden transition-opacity"
        />
      )}

      {/* Floating Menu */}
      <div className="fixed bottom-6 right-6 z-[70] md:hidden">
        {isOpen && (
          <div className="absolute bottom-20 right-0 flex flex-col gap-3 min-w-[200px]">
            {/* Page indicator */}
            <div className="glass rounded-lg p-3 text-center">
              <span className="text-sm font-semibold">
                Página {currentPage} / {totalPages}
              </span>
            </div>

            {/* Menu items */}
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    setIsOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={`glass rounded-lg p-4 flex items-center gap-3 transition-all ${
                  item.disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-accent/20 active:scale-95"
                } ${item.highlight ? "bg-accent/30 border-2 border-accent" : ""}`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={toggleMenu}
          className={`glass w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${
            isOpen ? "bg-primary text-primary-foreground" : "bg-background"
          }`}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
    </>
  );
};
