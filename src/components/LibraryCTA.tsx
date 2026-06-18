import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LibraryCTAVariant = "default" | "onboarding" | "post-install" | "empty-state";

const PRESETS: Record<LibraryCTAVariant, { title: string; description: string; buttonLabel: string }> = {
  default: {
    title: "Pronto para começar a ler?",
    description: "Acesse sua biblioteca agora e comece a aproveitar seus livros, destaques e resumos.",
    buttonLabel: "Ir para minha biblioteca",
  },
  onboarding: {
    title: "Vamos montar sua primeira estante 📚",
    description:
      "Sua conta está pronta. Acesse a biblioteca, envie seu primeiro PDF e descubra destaques, resumos e gamificação de leitura.",
    buttonLabel: "Criar minha biblioteca",
  },
  "post-install": {
    title: "Tudo pronto! Bem-vindo ao AURA READ 🎉",
    description:
      "Seu app está instalado. Abra sua biblioteca para enviar o primeiro PDF e começar a ler com destaques, resumos e sincronização entre dispositivos.",
    buttonLabel: "Abrir minha biblioteca",
  },
  "empty-state": {
    title: "Sua biblioteca está vazia 📖",
    description:
      "Envie seu primeiro PDF para começar a ler. Você poderá destacar trechos, gerar resumos com IA e acompanhar sua evolução de leitura.",
    buttonLabel: "Enviar meu primeiro PDF",
  },
};

interface LibraryCTAProps {
  variant?: LibraryCTAVariant;
  title?: string;
  description?: string;
  buttonLabel?: string;
  className?: string;
}

const LibraryCTA = ({
  variant = "default",
  title,
  description,
  buttonLabel,
  className,
}: LibraryCTAProps) => {
  const navigate = useNavigate();
  const preset = PRESETS[variant];
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-purple-500/10 p-8 text-center",
        className
      )}
    >
      <h2 className="text-2xl font-bold mb-2">{title ?? preset.title}</h2>
      <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
        {description ?? preset.description}
      </p>
      <Button size="lg" onClick={() => navigate("/library")} className="gap-2">
        <BookOpen className="w-4 h-4" />
        {buttonLabel ?? preset.buttonLabel}
      </Button>
    </div>
  );
};

export default LibraryCTA;
