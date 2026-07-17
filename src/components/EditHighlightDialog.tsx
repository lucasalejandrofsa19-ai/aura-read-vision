import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface EditHighlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractedText: string;
  onConfirm: (editedText: string) => void;
  onCancel: () => void;
}

export const EditHighlightDialog = ({
  open,
  onOpenChange,
  extractedText,
  onConfirm,
  onCancel,
}: EditHighlightDialogProps) => {
  const [text, setText] = useState(extractedText);

  const handleConfirm = () => {
    onConfirm(text);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="reveal-on-scroll">
          <DialogTitle>Editar Texto Extraído</DialogTitle>
          <DialogDescription>
            Revise e edite o texto extraído do destaque antes de salvá-lo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 reveal-on-scroll reveal-delay-1">
          <div className="space-y-2">
            <Label htmlFor="highlight-text">Texto do Destaque</Label>
            <Textarea
              id="highlight-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Edite o texto extraído..."
              className="min-h-[200px] resize-y"
            />
            <p className="text-xs text-muted-foreground">
              {text.length} caracteres • {text.split(/\s+/).filter(Boolean).length} palavras
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 reveal-on-scroll reveal-delay-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!text.trim()}>
            Salvar Destaque
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
