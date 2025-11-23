import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const APP_VERSION_KEY = 'app_version';
const ERROR_COUNT_KEY = 'app_error_count';
const LAST_UPDATE_KEY = 'last_update_timestamp';
const MAX_ERRORS_THRESHOLD = 3;

export const useAppHealth = () => {
  const [hasIssues, setHasIssues] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    // Get current version from meta tag or default
    const getCurrentVersion = () => {
      const metaVersion = document.querySelector('meta[name="version"]');
      return metaVersion?.getAttribute('content') || Date.now().toString();
    };

    const currentVersion = getCurrentVersion();
    const storedVersion = localStorage.getItem(APP_VERSION_KEY);
    const storedErrorCount = parseInt(localStorage.getItem(ERROR_COUNT_KEY) || '0', 10);

    // Check if version changed (app was updated)
    if (storedVersion && storedVersion !== currentVersion) {
      console.log('App updated from', storedVersion, 'to', currentVersion);
      // Reset error count on version change
      localStorage.setItem(ERROR_COUNT_KEY, '0');
      localStorage.setItem(LAST_UPDATE_KEY, Date.now().toString());
      setErrorCount(0);
      
      // Show update success notification
      toast.success('App atualizado com sucesso!', {
        description: 'Versão atualizada e pronta para uso',
      });
    } else {
      setErrorCount(storedErrorCount);
      
      // Check if we have too many errors
      if (storedErrorCount >= MAX_ERRORS_THRESHOLD) {
        setHasIssues(true);
        showRecoveryOptions();
      }
    }

    // Update stored version
    localStorage.setItem(APP_VERSION_KEY, currentVersion);

    // Global error handler
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      incrementErrorCount();
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      incrementErrorCount();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const incrementErrorCount = () => {
    const currentCount = parseInt(localStorage.getItem(ERROR_COUNT_KEY) || '0', 10);
    const newCount = currentCount + 1;
    localStorage.setItem(ERROR_COUNT_KEY, newCount.toString());
    setErrorCount(newCount);

    if (newCount >= MAX_ERRORS_THRESHOLD) {
      setHasIssues(true);
      showRecoveryOptions();
    }
  };

  const showRecoveryOptions = () => {
    toast.error('Problemas detectados após atualização', {
      description: 'Detectamos múltiplos erros. Deseja limpar o cache?',
      duration: Infinity,
      action: {
        label: 'Limpar Cache',
        onClick: () => clearCacheAndReload(),
      },
    });
  };

  const clearCacheAndReload = async () => {
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('All caches cleared');
      }

      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => registration.unregister())
        );
        console.log('All service workers unregistered');
      }

      // Clear localStorage error tracking
      localStorage.removeItem(ERROR_COUNT_KEY);
      localStorage.removeItem(LAST_UPDATE_KEY);

      toast.success('Cache limpo!', {
        description: 'Recarregando aplicação...',
      });

      // Reload after a brief delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Erro ao limpar cache', {
        description: 'Tente recarregar manualmente a página',
      });
    }
  };

  const resetErrorCount = () => {
    localStorage.setItem(ERROR_COUNT_KEY, '0');
    setErrorCount(0);
    setHasIssues(false);
  };

  return {
    hasIssues,
    errorCount,
    clearCacheAndReload,
    resetErrorCount,
  };
};
