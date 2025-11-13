import { useCallback } from "react";
import * as Sentry from "@sentry/react";

export const useSentryTracking = () => {
  const trackClick = useCallback((elementName: string, metadata?: Record<string, any>) => {
    Sentry.startSpan(
      {
        name: `click.${elementName}`,
        op: "ui.click",
        attributes: metadata,
      },
      () => {
        // Span automatically ends when callback completes
        if (metadata) {
          Sentry.setContext("clickContext", metadata);
        }
      }
    );
  }, []);

  const trackFormSubmission = useCallback((formName: string, metadata?: Record<string, any>) => {
    Sentry.startSpan(
      {
        name: `form.submit.${formName}`,
        op: "ui.form.submit",
        attributes: metadata,
      },
      () => {
        if (metadata) {
          Sentry.setContext("formContext", metadata);
        }
      }
    );
  }, []);

  const trackInteraction = useCallback((interactionName: string, metadata?: Record<string, any>) => {
    Sentry.startSpan(
      {
        name: interactionName,
        op: "ui.interaction",
        attributes: metadata,
      },
      () => {
        if (metadata) {
          Sentry.setContext("interactionContext", metadata);
        }
      }
    );
  }, []);

  const trackAsyncOperation = useCallback(
    async <T,>(operationName: string, operation: () => Promise<T>, metadata?: Record<string, any>): Promise<T> => {
      return await Sentry.startSpan(
        {
          name: operationName,
          op: "async.operation",
          attributes: metadata,
        },
        async () => {
          if (metadata) {
            Sentry.setContext("operationContext", metadata);
          }
          return await operation();
        }
      );
    },
    []
  );

  return {
    trackClick,
    trackFormSubmission,
    trackInteraction,
    trackAsyncOperation,
  };
};
