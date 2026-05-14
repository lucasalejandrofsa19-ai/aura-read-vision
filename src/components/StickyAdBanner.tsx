import { Capacitor } from "@capacitor/core";
import { useUserData } from "@/hooks/useUserData";
import { AdSenseUnit } from "./AdSenseUnit";
import { ADSENSE_SLOTS, ADSENSE_MODE } from "@/lib/adsense";

/**
 * Banner fixo no rodapé (web). Em build nativo o AdMob assume.
 * Oculto para Premium/Pro/Admin e em modo "off".
 */
export const StickyAdBanner = () => {
  const { hasPremiumAccess, isLoading } = useUserData();

  if (Capacitor.isNativePlatform()) return null;
  if (isLoading || hasPremiumAccess) return null;
  if (ADSENSE_MODE === "off") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border shadow-lg">
      <div className="max-w-5xl mx-auto px-2">
        <AdSenseUnit
          slot={ADSENSE_SLOTS.stickyFooter}
          format="auto"
          className="!my-1"
          style={{ minHeight: 60, maxHeight: 90 }}
          devLabel="Sticky footer"
        />
      </div>
    </div>
  );
};
