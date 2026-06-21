import { useEffect, useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Detecta navegadores in-app (Instagram, Facebook, TikTok, etc.) e força
 * a abertura do link no navegador externo (Chrome no Android, Safari/Chrome no iOS).
 *
 * - Android: usa `intent://` para abrir direto no Chrome.
 * - iOS: tenta `googlechrome://` e mostra fallback com botão "Copiar link".
 *
 * Aceita ?stayInApp=1 para desativar (caso o usuário queira ficar no webview).
 */
const IN_APP_REGEX =
  /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|MicroMessenger|TikTok|Twitter|Snapchat|WhatsApp|Pinterest/i;

export const OpenInBrowserGate = ({ children }: { children: React.ReactNode }) => {
  const [blocked, setBlocked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("stayInApp") === "1") return;
      if (localStorage.getItem("openInBrowser:dismissed") === "1") return;

      const ua = navigator.userAgent || "";
      if (!IN_APP_REGEX.test(ua)) return;

      const ios = /iPhone|iPad|iPod/i.test(ua);
      const android = /Android/i.test(ua);
      const url = window.location.href;

      if (android) {
        // Intent URL — abre direto no Chrome no Android
        const cleanUrl = url.replace(/^https?:\/\//, "");
        const intent = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
        window.location.href = intent;
        // se não funcionar, mostra fallback após 1.5s
        setTimeout(() => setBlocked(true), 1500);
        return;
      }

      if (ios) {
        // No iOS, googlechrome:// só funciona se Chrome estiver instalado.
        // Mostra fallback com instrução manual (mais confiável).
        setBlocked(true);
        return;
      }

      setBlocked(true);
    } catch {
      /* ignora */
    }
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignora */
    }
  };

  const stayInApp = () => {
    try {
      localStorage.setItem("openInBrowser:dismissed", "1");
    } catch {
      /* ignora */
    }
    setBlocked(false);
  };

  const openChromeIOS = () => {
    const url = window.location.href.replace(/^https?:\/\//, "");
    window.location.href = `googlechrome://${url}`;
  };

  if (!blocked) return <>{children}</>;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ios = /iPhone|iPad|iPod/i.test(ua);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-2xl border border-border/60 bg-card p-6 shadow-xl text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <ExternalLink className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-lg font-bold mb-2">Abra no navegador</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Para ler o PDF corretamente, abra este link no Chrome ou Safari — o
          navegador interno do Instagram bloqueia recursos necessários.
        </p>

        {ios ? (
          <div className="space-y-3">
            <Button onClick={openChromeIOS} className="w-full gap-2">
              <ExternalLink className="w-4 h-4" />
              Abrir no Chrome
            </Button>
            <Button onClick={copyLink} variant="outline" className="w-full gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Link copiado!" : "Copiar link"}
            </Button>
            <p className="text-xs text-muted-foreground pt-2">
              Toque nos três pontos (•••) no canto superior direito e selecione
              <strong> "Abrir no navegador"</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={copyLink} variant="outline" className="w-full gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Link copiado!" : "Copiar link"}
            </Button>
            <p className="text-xs text-muted-foreground pt-2">
              Toque nos três pontos (⋮) no canto superior direito e selecione
              <strong> "Abrir no navegador externo"</strong>.
            </p>
          </div>
        )}

        <button
          onClick={stayInApp}
          className="mt-5 text-xs text-muted-foreground underline hover:text-foreground"
        >
          Continuar mesmo assim
        </button>
      </div>
    </div>
  );
};
