import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, MailX } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { kind: "validating" }
  | { kind: "valid"; email: string }
  | { kind: "already" }
  | { kind: "invalid"; reason?: string }
  | { kind: "submitting"; email: string }
  | { kind: "success"; email: string }
  | { kind: "error"; message: string };

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "validating" });

  useEffect(() => {
    document.title = "Cancelar e-mails · AuraRead";
    if (!token) {
      setState({ kind: "invalid", reason: "Link inválido ou expirado." });
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({ kind: "invalid", reason: data?.error ?? "Link inválido ou expirado." });
          return;
        }
        if (data?.already_unsubscribed) {
          setState({ kind: "already" });
          return;
        }
        setState({ kind: "valid", email: data?.email ?? "seu endereço" });
      } catch {
        setState({ kind: "invalid", reason: "Não foi possível validar o link." });
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (state.kind !== "valid" || !token) return;
    setState({ kind: "submitting", email: state.email });
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON,
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ kind: "error", message: data?.error ?? "Algo deu errado. Tente novamente." });
        return;
      }
      setState({ kind: "success", email: state.email });
    } catch {
      setState({ kind: "error", message: "Falha de conexão. Tente novamente em instantes." });
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8 space-y-6">
        <header className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <MailX className="w-6 h-6 text-primary" aria-hidden />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] font-semibold text-primary">
            AuraRead
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Preferências de e-mail
          </h1>
        </header>

        {state.kind === "validating" && (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Validando seu link...</p>
          </div>
        )}

        {state.kind === "valid" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              Quer mesmo deixar de receber e-mails da AuraRead em{" "}
              <span className="font-medium text-foreground">{state.email}</span>?
              Você não receberá mais novidades, dicas ou atualizações de produto.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={confirm} variant="destructive" className="w-full">
                Confirmar cancelamento
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Manter inscrição</Link>
              </Button>
            </div>
          </div>
        )}

        {state.kind === "submitting" && (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Processando...</p>
          </div>
        )}

        {state.kind === "success" && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <CheckCircle2 className="w-10 h-10 text-primary" />
            <div className="space-y-1">
              <h2 className="font-semibold text-foreground">Inscrição cancelada</h2>
              <p className="text-sm text-muted-foreground">
                Pronto. <span className="font-medium text-foreground">{state.email}</span>{" "}
                não receberá mais e-mails da AuraRead. Mudou de ideia? É só voltar a usar a plataforma.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Voltar para o início</Link>
            </Button>
          </div>
        )}

        {state.kind === "already" && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <CheckCircle2 className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Este endereço já está com a inscrição cancelada. Nenhuma ação é necessária.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Voltar para o início</Link>
            </Button>
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {state.reason ?? "Este link de cancelamento não é válido ou já expirou."}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Voltar para o início</Link>
            </Button>
          </div>
        )}

        {state.kind === "error" && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
              Tentar novamente
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
};

export default Unsubscribe;
