import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, AlertCircle, MailX, ShieldCheck } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface Prefs {
  ads: boolean;
  content: boolean;
  product_updates: boolean;
}

type State =
  | { kind: "validating" }
  | { kind: "ready"; email: string; prefs: Prefs; alreadyOff: boolean }
  | { kind: "saving"; email: string; prefs: Prefs; alreadyOff: boolean }
  | { kind: "saved"; email: string; prefs: Prefs; fullyUnsubscribed: boolean }
  | { kind: "invalid"; reason?: string }
  | { kind: "error"; message: string };

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "validating" });

  useEffect(() => {
    document.title = "Preferências de e-mail · AuraRead";
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
        if (!res.ok || !data?.valid) {
          setState({ kind: "invalid", reason: data?.error ?? "Link inválido ou expirado." });
          return;
        }
        setState({
          kind: "ready",
          email: data.email ?? "seu endereço",
          prefs: {
            ads: data.preferences?.ads ?? !data.already_unsubscribed,
            content: data.preferences?.content ?? !data.already_unsubscribed,
            product_updates: data.preferences?.product_updates ?? !data.already_unsubscribed,
          },
          alreadyOff: !!data.already_unsubscribed,
        });
      } catch {
        setState({ kind: "invalid", reason: "Não foi possível validar o link." });
      }
    })();
  }, [token]);

  const updatePref = (key: keyof Prefs, value: boolean) => {
    setState((s) =>
      s.kind === "ready" ? { ...s, prefs: { ...s.prefs, [key]: value } } : s
    );
  };

  const save = async (prefsOverride?: Prefs) => {
    if (state.kind !== "ready" || !token) return;
    const prefs = prefsOverride ?? state.prefs;
    setState({ kind: "saving", email: state.email, prefs, alreadyOff: state.alreadyOff });
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON },
        body: JSON.stringify({ token, preferences: prefs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setState({ kind: "error", message: data?.error ?? "Algo deu errado. Tente novamente." });
        return;
      }
      setState({
        kind: "saved",
        email: state.email,
        prefs: data.preferences ?? prefs,
        fullyUnsubscribed: !!data.fully_unsubscribed,
      });
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

        {(state.kind === "ready" || state.kind === "saving") && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground text-center">
              Gerenciando preferências de{" "}
              <span className="font-medium text-foreground">{state.email}</span>
            </p>

            <div className="space-y-4 rounded-lg border border-border p-4">
              <PrefRow
                id="marketing"
                title="E-mails promocionais"
                description="Ofertas, lançamentos e descontos."
                checked={state.prefs.marketing}
                disabled={state.kind === "saving"}
                onChange={(v) => updatePref("marketing", v)}
              />
              <Separator />
              <PrefRow
                id="product_updates"
                title="Novidades do produto"
                description="Recursos novos, dicas e melhorias."
                checked={state.prefs.product_updates}
                disabled={state.kind === "saving"}
                onChange={(v) => updatePref("product_updates", v)}
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-muted-foreground leading-relaxed">
                E-mails essenciais (segurança, recibos, redefinição de senha e
                avisos da sua conta) continuarão sendo enviados sempre — são
                exigidos para o funcionamento da sua conta.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => save()}
                disabled={state.kind === "saving"}
                className="w-full"
              >
                {state.kind === "saving" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar preferências"
                )}
              </Button>
              <Button
                variant="ghost"
                disabled={state.kind === "saving"}
                onClick={() => save({ marketing: false, product_updates: false })}
                className="w-full text-muted-foreground hover:text-destructive"
              >
                Cancelar todos os e-mails não-essenciais
              </Button>
            </div>
          </div>
        )}

        {state.kind === "saved" && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <CheckCircle2 className="w-10 h-10 text-primary" />
            <div className="space-y-1">
              <h2 className="font-semibold text-foreground">
                {state.fullyUnsubscribed ? "Inscrição cancelada" : "Preferências atualizadas"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {state.fullyUnsubscribed
                  ? `${state.email} não receberá mais e-mails promocionais. Mensagens essenciais da conta continuam ativas.`
                  : "Aplicamos suas escolhas. Você pode voltar aqui a qualquer momento."}
              </p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Voltar para o início</Link>
            </Button>
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {state.reason ?? "Este link não é válido ou já expirou."}
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

interface PrefRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

const PrefRow = ({ id, title, description, checked, disabled, onChange }: PrefRowProps) => (
  <div className="flex items-start justify-between gap-4">
    <div className="space-y-0.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">
        {title}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
  </div>
);

export default Unsubscribe;
