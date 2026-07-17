import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export const useAppUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const updatePendingRef = useRef(false);
  const toastIdRef = useRef<string | number | undefined>();

  useEffect(() => {
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
      // Get service worker registration
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
        
        // Check for updates every 60 seconds (silent background)
        setInterval(() => {
          reg.update().catch(() => {});
        }, 60 * 1000);

        // Also re-check whenever the tab becomes visible
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) reg.update().catch(() => {});
        });

        // Initial update check
        reg.update();

        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // With skipWaiting + clientsClaim, apply the update
                // silently and immediately — no user prompt.
                console.log('New SW installed, applying silently');
                updatePendingRef.current = true;
                setUpdateReady(true);
                // Trigger reload as soon as the new SW takes control
                // (controllerchange handler below handles the actual reload).
                setTimeout(() => handleUpdate(), 500);
              }
            });
          }
        });
      });

      // Listen for visibility change to update when user returns
      const handleVisibilityChange = () => {
        if (!document.hidden && updatePendingRef.current) {
          console.log('User returned, applying update...');
          // User came back and there's a pending update
          setTimeout(() => {
            handleUpdate();
          }, 1000); // Small delay to let the app settle
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Listen for controller change (when new SW takes control)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New service worker took control, reloading...');
        window.location.reload();
      });

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, []);

  const handleUpdate = async () => {
    console.log('Applying update...');
    setUpdateReady(false);
    setUpdateAvailable(false);
    updatePendingRef.current = false;
    
    // Dismiss toast if it exists
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
    
    // With skipWaiting: true in workbox config, just reload
    window.location.reload();
  };

  const dismissUpdate = () => {
    setUpdateAvailable(false);
    updatePendingRef.current = false;
    
    // Dismiss toast if it exists
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
  };

  return {
    updateAvailable,
    updateReady,
    handleUpdate,
    dismissUpdate,
  };
};
