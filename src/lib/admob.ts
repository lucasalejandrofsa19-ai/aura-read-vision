import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  type BannerAdOptions,
  InterstitialAdPluginEvents,
  type AdOptions,
} from "@capacitor-community/admob";

/**
 * AdMob IDs.
 *
 * ⚠️ Por padrão usamos os IDs de TESTE oficiais do Google.
 * Substitua pelos seus IDs reais antes de publicar nas lojas.
 *
 * Crie os blocos de anúncio em: https://apps.admob.com
 */
export const ADMOB_IDS = {
  // App IDs (configurados no AndroidManifest.xml / Info.plist)
  appId: {
    android: "ca-app-pub-3940256099942544~3347511713", // teste
    ios: "ca-app-pub-3940256099942544~1458002511", // teste
  },
  banner: {
    android: "ca-app-pub-3940256099942544/6300978111", // teste
    ios: "ca-app-pub-3940256099942544/2934735716", // teste
  },
  interstitial: {
    android: "ca-app-pub-3940256099942544/1033173712", // teste
    ios: "ca-app-pub-3940256099942544/4411468910", // teste
  },
};

export const isNativePlatform = () => Capacitor.isNativePlatform();

const platformId = (ids: { android: string; ios: string }) =>
  Capacitor.getPlatform() === "ios" ? ids.ios : ids.android;

let initialized = false;

export const initAdMob = async () => {
  if (!isNativePlatform() || initialized) return;
  try {
    await AdMob.initialize({
      testingDevices: [],
      initializeForTesting: true,
    });
    initialized = true;
  } catch (err) {
    console.error("AdMob init error", err);
  }
};

export const showBanner = async () => {
  if (!isNativePlatform()) return;
  await initAdMob();
  const options: BannerAdOptions = {
    adId: platformId(ADMOB_IDS.banner),
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 0,
    isTesting: true, // mantenha true durante desenvolvimento
  };
  try {
    AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (e) =>
      console.warn("Banner failed", e),
    );
    await AdMob.showBanner(options);
  } catch (err) {
    console.error("Banner error", err);
  }
};

export const hideBanner = async () => {
  if (!isNativePlatform()) return;
  try {
    await AdMob.hideBanner();
  } catch {
    /* noop */
  }
};

export const removeBanner = async () => {
  if (!isNativePlatform()) return;
  try {
    await AdMob.removeBanner();
  } catch {
    /* noop */
  }
};

export const showInterstitial = async () => {
  if (!isNativePlatform()) return;
  await initAdMob();
  const options: AdOptions = {
    adId: platformId(ADMOB_IDS.interstitial),
    isTesting: true,
  };
  try {
    await AdMob.prepareInterstitial(options);
    await AdMob.showInterstitial();
    AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (e) =>
      console.warn("Interstitial failed", e),
    );
  } catch (err) {
    console.error("Interstitial error", err);
  }
};
