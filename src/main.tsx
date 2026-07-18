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
import { installLinkStatusLogger } from "./lib/linkStatusLog";
// Initialize PDF.js worker globally before rendering
import "./lib/pdfjsWorker";

// Instala o logger o mais cedo possível para capturar erros de boot que
// alimentam a tela /status (diagnóstico de "link não abre").
installLinkStatusLogger();
initSentry();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
