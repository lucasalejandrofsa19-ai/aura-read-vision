import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
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
