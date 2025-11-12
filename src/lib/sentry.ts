import * as Sentry from "@sentry/react";

export const initSentry = () => {
  // Only initialize if DSN is provided
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.warn("Sentry DSN not configured. Error tracking disabled.");
    return;
  }

  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Don't send sensitive data
    beforeSend(event) {
      // Remove sensitive data from error reports
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }
      return event;
    },
    
    // Environment
    environment: import.meta.env.MODE,
  });
};

// Helper to capture errors without exposing details to console
export const captureError = (error: unknown, context?: string) => {
  if (import.meta.env.DEV) {
    // In development, still log to console for debugging
    console.error(context ? `[${context}]` : "", error);
  }
  
  // Always send to Sentry if configured
  Sentry.captureException(error, {
    tags: {
      context: context || "unknown",
    },
  });
};
