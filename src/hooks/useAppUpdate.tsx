import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export const useAppUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
      // Get service worker registration
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
        
        // Check for updates every hour
        setInterval(() => {
          reg.update();
        }, 60 * 60 * 1000);

        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                setUpdateAvailable(true);
                setUpdateReady(true);
                
                toast.info('Nova versão disponível!', {
                  description: 'Clique para atualizar o app',
                  action: {
                    label: 'Atualizar',
                    onClick: () => handleUpdate(),
                  },
                  duration: Infinity,
                });
              }
            });
          }
        });
      });

      // Listen for controller change (when new SW takes control)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }, []);

  const handleUpdate = async () => {
    setUpdateReady(false);
    setUpdateAvailable(false);
    // With skipWaiting: true in workbox config, just reload
    window.location.reload();
  };

  const dismissUpdate = () => {
    setUpdateAvailable(false);
  };

  return {
    updateAvailable,
    updateReady,
    handleUpdate,
    dismissUpdate,
  };
};
