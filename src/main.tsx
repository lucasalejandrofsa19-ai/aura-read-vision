import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
// Initialize PDF.js worker globally before rendering
import "./lib/pdfjsWorker";

initSentry();

createRoot(document.getElementById("root")!).render(<App />);
