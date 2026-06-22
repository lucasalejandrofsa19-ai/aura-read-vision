import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Copy, Check, Bug } from "lucide-react";
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

interface InAppBrowserState {
  isInAppBrowser: boolean;
  detectedBy: string;
  isIOS: boolean;
  isAndroid: boolean;
  isWebView: boolean;
  currentUrl: string;
  chromeIntentUrl: string;
  chromeIOSUrl: string;
  userAgent: string;
}

const IN_APP_REGEX =
  /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|MicroMessenger|TikTok|Twitter|Snapchat|WhatsApp|Pinterest/i;

const getInAppBrowserState = (): InAppBrowserState => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isInAppBrowser: false,
      detectedBy: "n/a",
      isIOS: false,
      isAndroid: false,
      isWebView: false,
      currentUrl: "",
      chromeIntentUrl: "",
      chromeIOSUrl: "",
      userAgent: "",
    };
  }

  const params = new URLSearchParams(window.location.search);
  const ua = navigator.userAgent || "";
  const currentUrl = window.location.href;
  const urlWithoutScheme = currentUrl.replace(/^https?:\/\//, "");
  const stayInApp = params.get("stayInApp") === "1";

  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isWebView = /(wv|WebView)/i.test(ua) || /; wv\)/i.test(ua);

  let detectedBy = "none";
  if (stayInApp) {
    detectedBy = "stayInApp=1";
  } else if (IN_APP_REGEX.test(ua)) {
    const match = ua.match(IN_APP_REGEX);
    detectedBy = match ? match[0] : "in-app regex";
  } else if (isWebView) {
    detectedBy = "generic WebView";
  }

  return {
    isInAppBrowser: !stayInApp && (IN_APP_REGEX.test(ua) || isWebView),
    detectedBy,
    isIOS,
    isAndroid,
    isWebView,
    currentUrl,
    chromeIntentUrl: `intent://${urlWithoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`,
    chromeIOSUrl: `googlechrome://${urlWithoutScheme}`,
    userAgent: ua,
  };
};

export const OpenInBrowserGate = ({ children }: { children: React.ReactNode }) => {
  const initialState = useMemo(getInAppBrowserState, []);
  const [blocked, setBlocked] = useState(initialState.isInAppBrowser);
  const [copied, setCopied] = useState(false);
  const showDebug = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  }, []);

  const browserState = getInAppBrowserState();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const state = getInAppBrowserState();
      if (!state.isInAppBrowser) return;

      setBlocked(true);

      if (state.isAndroid) {
        // Tenta automaticamente, mas mantém a tela bloqueada porque o Instagram
        // frequentemente exige um toque do usuário para permitir intents.
        window.location.replace(state.chromeIntentUrl);
        return;
      }
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
    setBlocked(false);
  };

  const fallbackUrl = browserState.isAndroid
    ? browserState.chromeIntentUrl
    : browserState.isIOS
      ? browserState.chromeIOSUrl
      : browserState.currentUrl;

  const DebugPanel = () => (
    <div className="mt-5 text-left rounded-md border border-dashed border-border bg-muted/50 p-4 text-xs font-mono">
      <div className="flex items-center gap-2 mb-3 text-muted-foreground">
        <Bug className="w-4 h-4" />
        <span className="font-semibold uppercase tracking-wide">Debug</span>
      </div>
      <ul className="space-y-1.5 text-foreground/80 break-all">
        <li>
          <span className="text-muted-foreground">Detectado por:</span>{" "}
          <strong className="text-primary">{browserState.detectedBy}</strong>
        </li>
        <li>
          <span className="text-muted-foreground">Bloqueado:</span>{" "}
          {blocked ? "sim" : "não"}
        </li>
        <li>
          <span className="text-muted-foreground">Plataforma:</span>{" "}
          {browserState.isAndroid ? "Android" : browserState.isIOS ? "iOS" : "outro"}
        </li>
        <li>
          <span className="text-muted-foreground">WebView genérico:</span>{" "}
          {browserState.isWebView ? "sim" : "não"}
        </li>
        <li>
          <span className="text-muted-foreground">URL atual:</span>{" "}
          {browserState.currentUrl}
        </li>
        <li>
          <span className="text-muted-foreground">Link de fallback:</span>{" "}
          <span className="text-primary">{fallbackUrl}</span>
        </li>
        <li>
          <span className="text-muted-foreground">User-Agent:</span>{" "}
          {browserState.userAgent}
        </li>
      </ul>
    </div>
  );

  if (!blocked && !showDebug) return <>{children}</>;

  if (!blocked && showDebug) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-md mx-auto rounded-lg border border-border/60 bg-card p-6 shadow-xl">
          <h1 className="text-lg font-bold mb-2">Debug do navegador</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Modo de depuração ativado via <code className="text-primary">?debug=1</code>.
          </p>
          <DebugPanel />
          <Button onClick={stayInApp} variant="outline" className="w-full mt-5">
            Continuar para o app
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-lg border border-border/60 bg-card p-6 shadow-xl text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <ExternalLink className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-lg font-bold mb-2">Abra no navegador</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Para ler o PDF corretamente, abra este link no Chrome ou Safari — o
          navegador interno do Instagram bloqueia recursos necessários.
        </p>

        {browserState.isAndroid ? (
          <div className="space-y-3">
            <Button asChild className="w-full gap-2">
              <a href={browserState.chromeIntentUrl} rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
                Abrir no Chrome
              </a>
            </Button>
            <Button onClick={copyLink} variant="outline" className="w-full gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Link copiado!" : "Copiar link"}
            </Button>
            <p className="text-xs text-muted-foreground pt-2">
              Se o botão não abrir automaticamente, toque nos três pontos (⋮) e escolha
              <strong> "Abrir no Chrome"</strong> ou <strong>"Abrir no navegador externo"</strong>.
            </p>
          </div>
        ) : browserState.isIOS ? (
          <div className="space-y-3">
            <Button asChild className="w-full gap-2">
              <a href={browserState.chromeIOSUrl} rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
                Abrir no Chrome
              </a>
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

        {showDebug && <DebugPanel />}
      </div>
    </div>
  );
};
