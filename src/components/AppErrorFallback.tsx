import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

interface AppErrorFallbackProps {
  error: unknown;
  resetError?: () => void;
}

/**
 * Fallback UI exibido pelo Sentry.ErrorBoundary quando qualquer
 * erro de renderização não tratado atinge o topo da árvore React.
 *
 * Mostra mensagem amigável + ações de recuperação, evitando que
 * o usuário fique preso em uma tela em branco.
 */
export const AppErrorFallback = ({ error, resetError }: AppErrorFallbackProps) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Erro desconhecido";

  const handleReload = () => {
    try {
      resetError?.();
    } finally {
      window.location.reload();
    }
  };

  const handleHome = () => {
    try {
      resetError?.();
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <div
      role="alert"
      className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4"
    >
      <div className="max-w-md w-full rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-lg p-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="font-display text-xl font-semibold mb-2">
          Algo deu errado
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          Encontramos um erro inesperado. Já registramos o problema e você pode
          tentar novamente.
        </p>
        {import.meta.env.DEV && (
          <pre className="text-xs text-left bg-muted/50 rounded-lg p-3 mb-4 overflow-auto max-h-40">
            {message}
          </pre>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={handleReload} className="gap-2">
            <RotateCw className="w-4 h-4" aria-hidden="true" />
            Recarregar
          </Button>
          <Button variant="outline" onClick={handleHome} className="gap-2">
            <Home className="w-4 h-4" aria-hidden="true" />
            Ir para o início
          </Button>
        </div>
      </div>
    </div>
  );
};
