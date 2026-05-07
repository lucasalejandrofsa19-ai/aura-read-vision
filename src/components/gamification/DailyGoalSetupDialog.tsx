import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGamification } from "@/hooks/useGamification";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentGoal: number;
}

const PRESETS = [5, 10, 20, 30, 50];

export const DailyGoalSetupDialog = ({ open, onOpenChange, currentGoal }: Props) => {
  const { setDailyGoal } = useGamification();
  const [selected, setSelected] = useState(currentGoal);

  useEffect(() => {
    setSelected(currentGoal);
  }, [currentGoal, open]);

  const handleSave = async () => {
    await setDailyGoal(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Defina sua meta diária</DialogTitle>
          <DialogDescription>
            Quantas páginas você quer ler por dia? Você pode mudar quando quiser.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-2 my-4">
          {PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => setSelected(n)}
              className={`py-3 rounded-xl border-2 font-bold transition-colors ${
                selected === n
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {selected <= 5 && "Comece com calma — todo dia conta."}
          {selected > 5 && selected <= 10 && "Meta clássica para criar hábito."}
          {selected > 10 && selected <= 20 && "Ritmo de leitor frequente."}
          {selected > 20 && selected <= 30 && "Você está levando a sério!"}
          {selected > 30 && "Modo intenso — mestre dos livros."}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar meta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
