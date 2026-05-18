import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getConsent,
  setConsent,
  onConsentChange,
  type ConsentChoice,
} from "@/lib/cookieConsent";
import { loadAdSenseScript, ADSENSE_MODE } from "@/lib/adsense";

/**
 * Banner de consentimento (LGPD/GDPR).
 * - Renderiza apenas se nenhuma escolha foi feita.
 * - Em build nativo (Capacitor) o consentimento é gerido pelo SDK do AdMob.
 * - Após escolha (aceitar OU recusar), carrega o loader do AdSense.
 *   O Consent Mode v2 ajusta o tipo de anúncio (personalizado x não-personalizado).
 */
export const CookieConsentBanner = () => {
  const [choice, setChoice] = useState<ConsentChoice>(() => getConsent());

  useEffect(() => {
    const off = onConsentChange(setChoice);
    return () => {
      off();
    };
  }, []);

  // Se já decidiu antes e aprovou, garante que o script carregue.
  useEffect(() => {
    if (choice === "granted" && ADSENSE_MODE === "production") {
      loadAdSenseScript();
    }
  }, [choice]);

  if (Capacitor.isNativePlatform()) return null;
  if (ADSENSE_MODE === "off") return null;
  if (choice !== "unset") return null;

  const decide = (v: "granted" | "denied") => {
    setConsent(v);
    // Só carrega scripts de terceiros se o usuário APROVOU.
    if (v === "granted" && ADSENSE_MODE === "production") {
      loadAdSenseScript();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.25 }}
        role="dialog"
        aria-live="polite"
        aria-label="Consentimento de cookies"
        className="fixed bottom-0 left-0 right-0 z-[60] p-3 sm:p-4"
      >
        <div className="max-w-3xl mx-auto bg-card/95 backdrop-blur border border-border rounded-2xl shadow-2xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="hidden sm:flex w-10 h-10 rounded-full bg-primary/10 items-center justify-center flex-shrink-0">
              <Cookie className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base mb-1">
                Sua privacidade
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Usamos cookies para exibir anúncios e melhorar sua experiência.
                Nenhum script de terceiros (Google AdSense, analytics) é carregado
                até você aprovar. Se recusar, o app continua funcionando normalmente — sem anúncios.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decide("denied")}
                >
                  Recusar
                </Button>
                <Button
                  size="sm"
                  onClick={() => decide("granted")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Aceitar todos
                </Button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar (recusar)"
              onClick={() => decide("denied")}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
