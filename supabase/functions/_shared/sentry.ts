// Sentry helper compartilhado para Edge Functions (Deno).
// Reporta stack traces ao Sentry usando o SDK oficial Deno.
// DSN é lida de SENTRY_DSN (preferencial) ou VITE_SENTRY_DSN como fallback.
import * as Sentry from "https://deno.land/x/sentry@8.40.0/index.mjs";

let initialized = false;

export function initSentry(): boolean {
  if (initialized) return true;
  const dsn = Deno.env.get("SENTRY_DSN") || Deno.env.get("VITE_SENTRY_DSN");
  if (!dsn) return false;
  try {
    Sentry.init({
      dsn,
      tracesSampleRate: 0,
      environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
      defaultIntegrations: false,
    });
    initialized = true;
    return true;
  } catch (e) {
    console.error("[sentry] init failed:", (e as Error).message);
    return false;
  }
}

export function captureEdgeError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  try {
    if (!initSentry()) return;
    Sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(context)) {
        try {
          scope.setTag(k, String(v).slice(0, 200));
        } catch { /* ignore */ }
      }
      scope.setContext("edge_function", context);
      Sentry.captureException(error);
    });
  } catch (_) {
    // Nunca deixe a captura de erro derrubar a função.
  }
}

export type EdgeHandler = (req: Request) => Promise<Response> | Response;

/**
 * Envolve o handler de uma edge function com captura de erros não-tratados.
 * Erros lançados fora de try/catch existentes são reportados ao Sentry
 * com stack trace, tags (function, method, url) e devolvem 500 JSON.
 */
export function withSentry(functionName: string, handler: EdgeHandler): EdgeHandler {
  return async (req: Request) => {
    initSentry();
    try {
      return await handler(req);
    } catch (error) {
      captureEdgeError(error, {
        function: functionName,
        method: req.method,
        url: req.url,
      });
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }
  };
}
