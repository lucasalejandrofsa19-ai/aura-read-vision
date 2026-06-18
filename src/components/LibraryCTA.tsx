import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LibraryCTAProps {
  title?: string;
  description?: string;
  buttonLabel?: string;
  className?: string;
}

const LibraryCTA = ({
  title = "Pronto para começar a ler?",
  description = "Acesse sua biblioteca agora e comece a aproveitar seus livros, destaques e resumos.",
  buttonLabel = "Ir para minha biblioteca",
  className,
}: LibraryCTAProps) => {
  const navigate = useNavigate();
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-purple-500/10 p-8 text-center",
        className
      )}
    >
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-xl mx-auto">{description}</p>
      <Button size="lg" onClick={() => navigate("/library")} className="gap-2">
        <BookOpen className="w-4 h-4" />
        {buttonLabel}
      </Button>
    </div>
  );
};

export default LibraryCTA;
