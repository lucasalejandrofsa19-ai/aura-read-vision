import * as Sentry from "@sentry/react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { useEffect } from "react";

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.warn("Sentry DSN not configured. Error monitoring disabled.");
    return;
  }

  const isProduction = import.meta.env.MODE === 'production';
  
  Sentry.init({
    dsn,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        maskAllInputs: true,
      }),
    ],
    // Performance Monitoring
    // Produção: 10% das transações | Desenvolvimento: 100%
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    tracePropagationTargets: ["localhost", /^https:\/\/.*\.supabase\.co/, /^https:\/\/.*\.lovable\.app/],
    
    // Session Replay
    // Produção: 5% das sessões normais | Desenvolvimento: 20%
    replaysSessionSampleRate: isProduction ? 0.05 : 0.2,
    // Sempre captura 100% dos erros com replay
    replaysOnErrorSampleRate: 1.0,
    
    environment: import.meta.env.MODE,
    
    // Enable performance monitoring for specific operations
    beforeSend(event) {
      // Add custom logic if needed
      return event;
    },
    
    beforeSendTransaction(event) {
      // Filter or modify performance transactions if needed
      return event;
    },
  });
};

export const setUserContext = (user: { id: string; email?: string } | null) => {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    });
  } else {
    Sentry.setUser(null);
  }
};

export const captureError = (error: unknown, context?: Record<string, any>) => {
  if (context) {
    Sentry.setContext("additional", context);
  }
  Sentry.captureException(error);
};

// Start a custom performance transaction
export const startTransaction = (name: string, op: string) => {
  return Sentry.startSpan({ name, op }, () => {});
};

// Add performance measurements for user interactions
export const measureInteraction = (name: string, callback: () => void) => {
  return Sentry.startSpan(
    {
      name,
      op: "user.interaction",
    },
    callback
  );
};
