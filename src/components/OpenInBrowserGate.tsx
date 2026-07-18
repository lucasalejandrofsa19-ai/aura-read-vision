import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Copy, Check, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Detecta navegadores in-app (Instagram, Facebook, TikTok, Threads, LinkedIn,
 * WhatsApp, Discord, KakaoTalk, WeChat, Line, Twitter/X, Snapchat, Pinterest,
 * Slack, Teams, Naver, etc.) e força a abertura do link no navegador externo.
 *
 * - Android: dispara `intent://...;package=com.android.chrome` automaticamente
 *   e oferece fallback manual.
 * - iOS: tenta abrir via `x-safari-https://` (força Safari sem depender do Chrome
 *   estar instalado) e oferece fallback `googlechrome://` + instruções manuais.
 *
 * Bypass: `?stayInApp=1` desativa o gate (para debug).
 * Debug: `?debug=1` mostra painel com estado detectado + URL de fallback.
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
  safariIOSUrl: string;
  userAgent: string;
}

// Padrões de User-Agent de navegadores in-app conhecidos.
const IN_APP_REGEX =
  /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Threads|Line\/|MicroMessenger|WeChat|TikTok|musical_ly|BytedanceWebview|Twitter|TwitterAndroid|X-App|Snapchat|WhatsApp|Pinterest|LinkedInApp|Discord|KAKAOTALK|NAVER\(inapp|Slack|Teams|GSA\/|EdgiOS|MiuiBrowser|SamsungBrowser\/[0-9]+\.[0-9]+ .*wv/i;

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
      safariIOSUrl: "",
      userAgent: "",
    };
  }

  const params = new URLSearchParams(window.location.search);
  const ua = navigator.userAgent || "";
  const currentUrl = window.location.href;
  const urlWithoutScheme = currentUrl.replace(/^https?:\/\//, "");
  const stayInApp = params.get("stayInApp") === "1";

  const isAndroid = /Android/i.test(ua);
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ reporta como Mac; usa maxTouchPoints para detectar.
    (/Macintosh/i.test(ua) && typeof navigator !== "undefined" && (navigator as Navigator).maxTouchPoints > 1);

  // WebView Android tradicional (; wv) e WKWebView iOS sem "Safari/" no UA.
  const isAndroidWebView = isAndroid && (/; wv\)/i.test(ua) || /Version\/[\d.]+ Chrome\/[\d.]+ Mobile/.test(ua) && !/Safari\//.test(ua));
  const isIOSWebView = isIOS && !/Safari\//.test(ua) && /AppleWebKit/i.test(ua);
  const isWebView = isAndroidWebView || isIOSWebView || /(^|\W)wv(\W|$)/i.test(ua);

  const inAppMatch = ua.match(IN_APP_REGEX);
  const isInAppByRegex = Boolean(inAppMatch);

  let detectedBy = "none";
  if (stayInApp) {
    detectedBy = "stayInApp=1";
  } else if (isInAppByRegex) {
    detectedBy = inAppMatch ? inAppMatch[0] : "in-app regex";
  } else if (isWebView) {
    detectedBy = isIOSWebView ? "iOS WKWebView" : "Android WebView";
  }

  return {
    isInAppBrowser: !stayInApp && (isInAppByRegex || isWebView),
    detectedBy,
    isIOS,
    isAndroid,
    isWebView,
    currentUrl,
    chromeIntentUrl: `intent://${urlWithoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`,
    chromeIOSUrl: `googlechrome://${urlWithoutScheme}`,
    // x-safari-https:// força o Safari, mesmo que o link tenha vindo de outro app.
    safariIOSUrl: `x-safari-${currentUrl}`,
    userAgent: ua,
  };
};

export const OpenInBrowserGate = ({ children }: { children: React.ReactNode }) => {
  const initialState = useMemo(getInAppBrowserState, []);
  const [blocked, setBlocked] = useState(initialState.isInAppBrowser);
  const [copied, setCopied] = useState(false);
  const attemptedRef = useRef(false);
  const showDebug = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  }, []);

  const browserState = getInAppBrowserState();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    try {
      const state = getInAppBrowserState();
      if (!state.isInAppBrowser) return;

      setBlocked(true);

      if (state.isAndroid) {
        // Instagram/Facebook frequentemente exigem toque do usuário para
        // liberar intents; mesmo assim tentamos: quando aceita, o WebView
        // já entrega ao Chrome sem tela intermediária.
        window.location.replace(state.chromeIntentUrl);
        return;
      }

      if (state.isIOS) {
        // x-safari-https:// funciona no Instagram/Threads/LinkedIn em iOS 14+.
        // Se o app bloquear, o botão manual continua disponível.
        window.location.href = state.safariIOSUrl;
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
      /* ignora — usuário pode copiar manualmente da barra */
    }
  };

  const fallbackUrl = browserState.isAndroid
    ? browserState.chromeIntentUrl
    : browserState.isIOS
      ? browserState.safariIOSUrl
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
          <span className="text-muted-foreground">Bloqueado:</span> {blocked ? "sim" : "não"}
        </li>
        <li>
          <span className="text-muted-foreground">Plataforma:</span>{" "}
          {browserState.isAndroid ? "Android" : browserState.isIOS ? "iOS" : "outro"}
        </li>
        <li>
          <span className="text-muted-foreground">WebView:</span> {browserState.isWebView ? "sim" : "não"}
        </li>
        <li>
          <span className="text-muted-foreground">URL atual:</span> {browserState.currentUrl}
        </li>
        <li>
          <span className="text-muted-foreground">Fallback:</span>{" "}
          <span className="text-primary">{fallbackUrl}</span>
        </li>
        <li>
          <span className="text-muted-foreground">User-Agent:</span> {browserState.userAgent}
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
            Modo depuração via <code className="text-primary">?debug=1</code>. O gate não bloqueou este UA.
          </p>
          <DebugPanel />
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
          Detectamos que você está no navegador interno de um app
          {browserState.detectedBy !== "none" && browserState.detectedBy !== "generic WebView" ? (
            <> (<strong className="text-foreground">{browserState.detectedBy}</strong>)</>
          ) : null}
          . Para a AURA READ funcionar corretamente, abra no Chrome ou Safari.
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
              Se nada abrir, toque nos três pontos (⋮) no canto superior direito e escolha
              <strong> "Abrir no Chrome"</strong> ou <strong>"Abrir no navegador externo"</strong>.
            </p>
          </div>
        ) : browserState.isIOS ? (
          <div className="space-y-3">
            <Button asChild className="w-full gap-2">
              <a href={browserState.safariIOSUrl} rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
                Abrir no Safari
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full gap-2">
              <a href={browserState.chromeIOSUrl} rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
                Abrir no Chrome
              </a>
            </Button>
            <Button onClick={copyLink} variant="ghost" className="w-full gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Link copiado!" : "Copiar link"}
            </Button>
            <p className="text-xs text-muted-foreground pt-2">
              Se nada abrir, toque nos três pontos (•••) no canto superior direito e selecione
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
              Abra o menu do app e escolha <strong>"Abrir no navegador externo"</strong>.
            </p>
          </div>
        )}

        <a
          href="/status"
          className="block text-center text-xs text-muted-foreground underline mt-3 hover:text-foreground"
        >
          Ver status do link (diagnóstico)
        </a>

        {showDebug && <DebugPanel />}
      </div>
    </div>
  );
};
