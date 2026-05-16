// Google AdSense configuration
export const ADSENSE_CLIENT = "ca-pub-4870256203048688";

/**
 * Modos do AdSense:
 * - "production": carrega o script real do Google AdSense (após consentimento).
 * - "dev":        NÃO carrega o script. Renderiza placeholders visuais para QA local.
 * - "off":        Desativa qualquer anúncio.
 *
 * Override: VITE_ADSENSE_MODE no .env, ou localStorage.setItem("adsense_mode","off").
 */
export type AdSenseMode = "production" | "dev" | "off";

const envMode = (import.meta.env.VITE_ADSENSE_MODE as AdSenseMode | undefined);
const localMode =
  typeof window !== "undefined"
    ? (localStorage.getItem("adsense_mode") as AdSenseMode | null)
    : null;

export const ADSENSE_MODE: AdSenseMode =
  localMode || envMode || (import.meta.env.PROD ? "production" : "dev");

export const isAdsLive = ADSENSE_MODE === "production";

// Slot IDs — vazio = Auto Ads.
export const ADSENSE_SLOTS = {
  // "primeiro bloco aurea read" — banner 728x90 (responsivo no mobile).
  libraryTop: "9551964688",
  betweenBooks: "",
  summaryInline: "",
  stickyFooter: "9551964688",
};

/**
 * Carrega o script do AdSense uma única vez. Deve ser chamado
 * APÓS o usuário tomar uma decisão no banner de consentimento
 * (qualquer escolha — Consent Mode v2 ajusta o comportamento).
 */
export function loadAdSenseScript() {
  if (typeof document === "undefined") return;
  if (ADSENSE_MODE !== "production") return;
  if (document.querySelector('script[data-adsense-loader="true"]')) return;

  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  s.dataset.adsenseLoader = "true";
  document.head.appendChild(s);
}
