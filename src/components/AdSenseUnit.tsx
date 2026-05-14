import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useUserData } from "@/hooks/useUserData";
import { ADSENSE_CLIENT, ADSENSE_MODE, isAdsLive } from "@/lib/adsense";

interface AdSenseUnitProps {
  slot: string;
  format?: string;
  layout?: string;
  layoutKey?: string;
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Rótulo exibido no placeholder em modo dev. */
  devLabel?: string;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Bloco de anúncio AdSense.
 * - Oculto para usuários Premium/Pro/Admin.
 * - Não renderiza em build nativo (Capacitor) — lá usamos AdMob.
 * - Em modo "dev", renderiza um placeholder visual.
 * - Em modo "off", não renderiza nada.
 */
export const AdSenseUnit = ({
  slot,
  format = "auto",
  layout,
  layoutKey,
  responsive = true,
  className = "",
  style,
  devLabel,
}: AdSenseUnitProps) => {
  const { hasPremiumAccess, isLoading } = useUserData();
  const pushed = useRef(false);

  useEffect(() => {
    if (!isAdsLive) return;
    if (pushed.current) return;
    if (Capacitor.isNativePlatform()) return;
    if (hasPremiumAccess || isLoading) return;
    if (!slot) return; // Auto Ads: nada a empurrar manualmente
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (err) {
      console.warn("AdSense push error", err);
    }
  }, [hasPremiumAccess, isLoading, slot]);

  if (Capacitor.isNativePlatform() || hasPremiumAccess) return null;
  if (ADSENSE_MODE === "off") return null;

  // Modo dev: placeholder visual
  if (ADSENSE_MODE === "dev") {
    return (
      <div
        className={`adsense-container w-full flex justify-center my-4 ${className}`}
        style={style}
      >
        <div
          className="w-full flex items-center justify-center rounded-md border-2 border-dashed border-primary/40 bg-primary/5 text-xs text-muted-foreground py-6 px-3 text-center"
          style={{ minHeight: 80 }}
        >
          <span>
            [AdSense · dev placeholder]
            {devLabel ? ` — ${devLabel}` : ""}
            {slot ? ` · slot ${slot}` : " · Auto Ads"}
          </span>
        </div>
      </div>
    );
  }

  // Produção · Auto Ads (sem slot): nada a renderizar manualmente.
  if (!slot) return null;

  return (
    <div className={`adsense-container w-full flex justify-center my-4 ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", ...style }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-ad-layout={layout}
        data-ad-layout-key={layoutKey}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
};
