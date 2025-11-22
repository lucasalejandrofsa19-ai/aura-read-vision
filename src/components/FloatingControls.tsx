import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  const toggleMenu = () => setIsOpen(!isOpen);

  const menuItems = [
    {
      icon: ZoomIn,
      label: "Aumentar",
      onClick: onZoomIn,
      disabled: !canZoomIn,
    },
    {
      icon: ZoomOut,
      label: "Diminuir",
      onClick: onZoomOut,
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
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleMenu}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Floating Menu */}
      <div className="fixed bottom-6 right-6 z-[70] md:hidden">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-20 right-0 flex flex-col gap-3 min-w-[200px]"
            >
              {/* Page indicator */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-lg p-3 text-center"
              >
                <span className="text-sm font-semibold">
                  Página {currentPage} / {totalPages}
                </span>
              </motion.div>

              {/* Menu items */}
              {menuItems.map((item, index) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * (index + 2) }}
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
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleMenu}
          className={`glass w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all ${
            isOpen ? "bg-primary text-primary-foreground" : "bg-background"
          }`}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <X className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div
                key="menu"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Menu className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </>
  );
};
