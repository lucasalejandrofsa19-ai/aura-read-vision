import { useEffect } from "react";
import { useUserData } from "@/hooks/useUserData";
import { isNativePlatform, removeBanner, showBanner } from "@/lib/admob";

/**
 * Exibe um banner AdMob na parte inferior do app.
 * - Só roda em build nativo (Capacitor iOS/Android).
 * - Oculto para usuários Premium/Pro/Admin.
 */
export const useAdMobBanner = () => {
  const { hasPremiumAccess, isLoading } = useUserData();

  useEffect(() => {
    if (!isNativePlatform() || isLoading) return;
    if (hasPremiumAccess) {
      removeBanner();
      return;
    }
    showBanner();
    return () => {
      removeBanner();
    };
  }, [hasPremiumAccess, isLoading]);
};
