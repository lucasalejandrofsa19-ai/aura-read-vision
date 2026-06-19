import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
// Typography: Sora (display) + Manrope (body) — self-hosted via @fontsource
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import { initSentry } from "./lib/sentry";
import { initConsentDefaults } from "./lib/cookieConsent";
// Initialize PDF.js worker globally before rendering
import "./lib/pdfjsWorker";

// Define consent default (denied) ANTES de qualquer script de anúncio.
initConsentDefaults();
initSentry();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
