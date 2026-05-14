/**
 * Gerenciamento de consentimento de cookies (LGPD/GDPR + Google Consent Mode v2).
 *
 * Estados possíveis:
 * - "granted":  usuário aceitou anúncios personalizados.
 * - "denied":   usuário recusou (ainda permite anúncios não-personalizados/contextuais).
 * - "unset":    nenhuma escolha feita — não carregamos nada de terceiros.
 */
export type ConsentChoice = "granted" | "denied" | "unset";

const STORAGE_KEY = "cookie_consent_v1";
const LISTENERS = new Set<(c: ConsentChoice) => void>();

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function ensureGtag() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
}

/** Define o consent default (chamado uma vez no boot, antes de qualquer script). */
export function initConsentDefaults() {
  if (typeof window === "undefined") return;
  ensureGtag();
  // Default: tudo negado até o usuário escolher.
  window.gtag!("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  });
}

export function getConsent(): ConsentChoice {
  if (typeof window === "undefined") return "unset";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "granted" || v === "denied") return v;
  return "unset";
}

export function setConsent(choice: "granted" | "denied") {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, choice);
  ensureGtag();
  window.gtag!("consent", "update", {
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
    analytics_storage: choice,
  });
  LISTENERS.forEach((cb) => cb(choice));
}

export function onConsentChange(cb: (c: ConsentChoice) => void) {
  LISTENERS.add(cb);
  return () => {
    LISTENERS.delete(cb);
  };
}

/** Reabre o banner para o usuário trocar de ideia. */
export function resetConsent() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  LISTENERS.forEach((cb) => cb("unset"));
}
