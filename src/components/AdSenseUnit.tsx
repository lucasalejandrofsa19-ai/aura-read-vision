import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useUserData } from "@/hooks/useUserData";
import { ADSENSE_CLIENT } from "@/lib/adsense";

interface AdSenseUnitProps {
  slot: string;
  format?: string;
  layout?: string;
  layoutKey?: string;
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
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
 */
export const AdSenseUnit = ({
  slot,
  format = "auto",
  layout,
  layoutKey,
  responsive = true,
  className = "",
  style,
}: AdSenseUnitProps) => {
  const { hasPremiumAccess, isLoading } = useUserData();
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    if (Capacitor.isNativePlatform()) return;
    if (hasPremiumAccess || isLoading) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (err) {
      console.warn("AdSense push error", err);
    }
  }, [hasPremiumAccess, isLoading]);

  if (Capacitor.isNativePlatform() || hasPremiumAccess) return null;

  return (
    <div className={`adsense-container w-full flex justify-center my-4 ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", ...style }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot || "0000000000"}
        data-ad-format={format}
        data-ad-layout={layout}
        data-ad-layout-key={layoutKey}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
};
