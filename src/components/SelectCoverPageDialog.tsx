import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileImage } from "lucide-react";

interface SelectCoverPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPage: (pageNumber: number) => void;
  bookTitle: string;
  totalPages?: number;
  isLoading?: boolean;
}

export const SelectCoverPageDialog = ({
  open,
  onOpenChange,
  onSelectPage,
  bookTitle,
  totalPages,
  isLoading = false,
}: SelectCoverPageDialogProps) => {
  const [pageNumber, setPageNumber] = useState<string>("1");

  const handleSubmit = () => {
    const page = parseInt(pageNumber);
    if (page > 0 && (!totalPages || page <= totalPages)) {
      onSelectPage(page);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="w-5 h-5" />
            Escolher Página da Capa
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Escolha qual página do PDF "{bookTitle}" deseja usar como capa.
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="page-number">Número da Página</Label>
            <Input
              id="page-number"
              type="number"
              min="1"
              max={totalPages}
              value={pageNumber}
              onChange={(e) => setPageNumber(e.target.value)}
              placeholder="Digite o número da página"
              disabled={isLoading}
            />
            {totalPages && (
              <p className="text-xs text-muted-foreground">
                Este livro tem {totalPages} páginas
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !pageNumber || parseInt(pageNumber) < 1}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Gerando...
              </>
            ) : (
              "Gerar Capa"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
