import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
// Initialize PDF.js worker globally before rendering
import "./lib/pdfjsWorker";
import { loadAdSenseScript } from "./lib/adsense";

initSentry();
loadAdSenseScript();

createRoot(document.getElementById("root")!).render(<App />);
