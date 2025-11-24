import { useEffect, useRef } from 'react';

export const usePWAAutoUpdate = () => {
  const checkIntervalRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service Workers não suportados');
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          type: 'classic',
          updateViaCache: 'none'
        });

        console.log('[PWA] Service Worker registrado');

        // Força verificação imediata
        registration.update();

        // Verifica atualizações a cada 1 minuto
        checkIntervalRef.current = setInterval(async () => {
          console.log('[PWA] Verificando atualizações...');
          try {
            await registration.update();
          } catch (err) {
            console.error('[PWA] Erro ao verificar atualizações:', err);
          }
        }, 60 * 1000); // 1 minuto

        // Escuta por atualizações do SW
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] Nova versão instalada, recarregando em 2s...');
              
              // Recarrega após 2 segundos
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            }
          });
        });

        // Escuta mensagens do SW
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[PWA] Novo Service Worker ativo');
          window.location.reload();
        });

      } catch (error) {
        console.error('[PWA] Erro no registro do SW:', error);
      }
    };

    registerSW();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  return {};
};

