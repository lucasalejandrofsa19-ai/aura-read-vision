import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

interface PrefetchIndicatorProps {
  isActive: boolean;
  cachedPagesCount: number;
}

export const PrefetchIndicator = ({ isActive, cachedPagesCount }: PrefetchIndicatorProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isActive) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-2 left-2 z-10 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Zap className="w-3 h-3 animate-pulse" />
            <span>Carregando próximas páginas...</span>
            {cachedPagesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-primary/20 text-[10px]">
                {cachedPagesCount} em cache
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
