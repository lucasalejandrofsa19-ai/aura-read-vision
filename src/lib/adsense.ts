// Google AdSense configuration
export const ADSENSE_CLIENT = "ca-pub-4870256203048688";

/**
 * Modos do AdSense:
 * - "production": carrega o script real do Google AdSense e renderiza anúncios.
 *                 Use Auto Ads (slots vazios) ou unidades manuais (slots preenchidos).
 * - "dev":        NÃO carrega o script. Renderiza placeholders visuais para QA local.
 *                 Evita avisos do Google sobre "ads em ambiente não autorizado".
 * - "off":        Desativa qualquer anúncio (nada é renderizado, nada é carregado).
 *
 * Como alternar:
 * 1. Padrão automático: dev usa "dev", build de produção usa "production".
 * 2. Override manual: defina VITE_ADSENSE_MODE no .env (production | dev | off).
 * 3. Em runtime no navegador: localStorage.setItem("adsense_mode", "off") e recarregue.
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

// Slot IDs — vazio = Auto Ads (Google decide as posições no painel).
// Preencha com data-ad-slot reais para usar unidades manuais.
export const ADSENSE_SLOTS = {
  libraryTop: "",
  betweenBooks: "",
  summaryInline: "",
  stickyFooter: "",
};

/**
 * Carrega o script do AdSense apenas em modo "production".
 * Chamado uma única vez a partir de main.tsx.
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
