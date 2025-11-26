import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Highlighter, Trash2 } from "lucide-react";

interface EditHighlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  onDelete: () => void;
}

const HIGHLIGHT_COLORS = [
  { name: "Amarelo", value: "#fef08a", class: "bg-yellow-200" },
  { name: "Verde", value: "#bbf7d0", class: "bg-green-200" },
  { name: "Azul", value: "#bfdbfe", class: "bg-blue-200" },
  { name: "Rosa", value: "#fbcfe8", class: "bg-pink-200" },
  { name: "Roxo", value: "#e9d5ff", class: "bg-purple-200" },
  { name: "Laranja", value: "#fed7aa", class: "bg-orange-200" },
];

export const EditHighlightDialog = ({
  open,
  onOpenChange,
  currentColor,
  onColorChange,
  onDelete,
}: EditHighlightDialogProps) => {
  const [selectedColor, setSelectedColor] = useState(currentColor);

  const handleSave = () => {
    onColorChange(selectedColor);
    onOpenChange(false);
  };

  const handleDelete = () => {
    onDelete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Destaque</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-3">Escolha uma nova cor</p>
            <div className="grid grid-cols-3 gap-2">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setSelectedColor(color.value)}
                  className={`${color.class} h-16 rounded-md border-2 transition-all hover:scale-105 relative ${
                    selectedColor === color.value
                      ? "border-primary ring-2 ring-primary ring-offset-2 shadow-lg"
                      : "border-border"
                  }`}
                  title={color.name}
                >
                  {selectedColor === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Highlighter className="w-6 h-6 text-primary drop-shadow-md" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-between">
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
