/**
 * Captura de erros do cliente para a tela "/status".
 *
 * Instala listeners globais o mais cedo possível (main.tsx) e persiste
 * eventos em sessionStorage. A tela /status lê e formata para diagnóstico
 * quando o app não carrega no dispositivo do usuário.
 */

export type LinkStatusLevel = "error" | "warn" | "info" | "unhandled" | "resource";

export interface LinkStatusEntry {
  ts: number;
  level: LinkStatusLevel;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  url?: string;
}

const STORAGE_KEY = "auraread:link-status-log:v1";
const MAX_ENTRIES = 100;

let installed = false;

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

const readAll = (): LinkStatusEntry[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = (entries: LinkStatusEntry[]) => {
  if (!isBrowser()) return;
  try {
    const trimmed = entries.slice(-MAX_ENTRIES);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage cheio ou bloqueado — ignora silenciosamente */
  }
};

export const pushLinkStatusEntry = (entry: Omit<LinkStatusEntry, "ts" | "url"> & { ts?: number; url?: string }) => {
  if (!isBrowser()) return;
  const full: LinkStatusEntry = {
    ts: entry.ts ?? Date.now(),
    url: entry.url ?? window.location.href,
    level: entry.level,
    message: entry.message,
    stack: entry.stack,
    source: entry.source,
    line: entry.line,
    column: entry.column,
  };
  const all = readAll();
  all.push(full);
  writeAll(all);
};

export const getLinkStatusEntries = (): LinkStatusEntry[] => readAll();

export const clearLinkStatusEntries = () => writeAll([]);

const safeString = (v: unknown): string => {
  if (v instanceof Error) return v.message;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const stackOf = (v: unknown): string | undefined => {
  if (v instanceof Error && v.stack) return v.stack;
  return undefined;
};

/**
 * Instala listeners globais: window.onerror, unhandledrejection e
 * intercepta console.error/console.warn preservando o comportamento original.
 * Idempotente.
 */
export const installLinkStatusLogger = () => {
  if (!isBrowser() || installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    // Erro de recurso (img/script/link): event.target não é window.
    const target = event.target as
      | (HTMLElement & { src?: string; href?: string; tagName?: string })
      | null;
    if (target && target !== (window as unknown as EventTarget) && target.tagName) {
      const src = target.src || target.href || "";
      pushLinkStatusEntry({
        level: "resource",
        message: `Falha ao carregar recurso <${target.tagName.toLowerCase()}> ${src}`,
        source: src,
      });
      return;
    }
    pushLinkStatusEntry({
      level: "error",
      message: safeString(event.message || event.error),
      stack: stackOf(event.error),
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    pushLinkStatusEntry({
      level: "unhandled",
      message: `Unhandled rejection: ${safeString(event.reason)}`,
      stack: stackOf(event.reason),
    });
  });

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const stack = args.map(stackOf).find(Boolean);
      pushLinkStatusEntry({
        level: "error",
        message: args.map(safeString).join(" "),
        stack,
      });
    } catch { /* ignore */ }
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    try {
      pushLinkStatusEntry({
        level: "warn",
        message: args.map(safeString).join(" "),
      });
    } catch { /* ignore */ }
    origWarn(...args);
  };

  // Marca boot bem-sucedido — ajuda a distinguir "não carregou" de "carregou e quebrou depois".
  pushLinkStatusEntry({
    level: "info",
    message: "logger instalado",
  });
};

export interface LinkStatusEnvSnapshot {
  userAgent: string;
  language: string;
  online: boolean;
  cookieEnabled: boolean;
  viewport: string;
  dpr: number;
  url: string;
  referrer: string;
  timestamp: string;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  storage: {
    localStorage: boolean;
    sessionStorage: boolean;
  };
  serviceWorker: {
    supported: boolean;
    controllerScope?: string;
    registrations: number;
  };
  standalone: boolean;
}

export const collectEnvSnapshot = async (): Promise<LinkStatusEnvSnapshot> => {
  if (!isBrowser()) {
    return {
      userAgent: "",
      language: "",
      online: false,
      cookieEnabled: false,
      viewport: "",
      dpr: 1,
      url: "",
      referrer: "",
      timestamp: new Date().toISOString(),
      storage: { localStorage: false, sessionStorage: false },
      serviceWorker: { supported: false, registrations: 0 },
      standalone: false,
    };
  }

  const testStorage = (s: Storage | undefined): boolean => {
    try {
      if (!s) return false;
      const k = "__probe__";
      s.setItem(k, "1");
      s.removeItem(k);
      return true;
    } catch {
      return false;
    }
  };

  let regs = 0;
  let controllerScope: string | undefined;
  const swSupported = "serviceWorker" in navigator;
  if (swSupported) {
    try {
      const list = await navigator.serviceWorker.getRegistrations();
      regs = list.length;
      controllerScope = navigator.serviceWorker.controller?.scriptURL;
    } catch { /* ignore */ }
  }

  const conn = (navigator as Navigator & { connection?: {
    effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean;
  } }).connection;

  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    online: navigator.onLine,
    cookieEnabled: navigator.cookieEnabled,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    dpr: window.devicePixelRatio || 1,
    url: window.location.href,
    referrer: document.referrer,
    timestamp: new Date().toISOString(),
    connection: conn
      ? {
          effectiveType: conn.effectiveType,
          downlink: conn.downlink,
          rtt: conn.rtt,
          saveData: conn.saveData,
        }
      : undefined,
    storage: {
      localStorage: testStorage(window.localStorage),
      sessionStorage: testStorage(window.sessionStorage),
    },
    serviceWorker: {
      supported: swSupported,
      controllerScope,
      registrations: regs,
    },
    standalone:
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
};
