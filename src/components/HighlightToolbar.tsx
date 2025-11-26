import { Button } from "@/components/ui/button";
import { Highlighter, X } from "lucide-react";

interface HighlightToolbarProps {
  onAddHighlight: () => void;
  onCancel: () => void;
  isDrawingMode: boolean;
}

export const HighlightToolbar = ({
  onAddHighlight,
  onCancel,
  isDrawingMode,
}: HighlightToolbarProps) => {

  return (
    <div className="glass rounded-lg p-2 flex items-center gap-2">
      {!isDrawingMode ? (
        <Button
          onClick={onAddHighlight}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Highlighter className="h-4 w-4" />
          Destacar
        </Button>
      ) : (
        <Button
          onClick={onCancel}
          variant="destructive"
          size="sm"
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Cancelar
        </Button>
      )}
    </div>
  );
};
