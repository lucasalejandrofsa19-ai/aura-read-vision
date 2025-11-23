import { useAppUpdate } from '@/hooks/useAppUpdate';
import { Button } from '@/components/ui/button';
import { Download, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const UpdateNotification = () => {
  const { updateAvailable, updateReady, handleUpdate, dismissUpdate } = useAppUpdate();

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50"
        >
          <div className="bg-card border border-border rounded-lg shadow-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                {updateReady ? (
                  <Download className="h-5 w-5 text-primary" />
                ) : (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground mb-1">
                  {updateReady ? 'Nova Versão Disponível' : 'Preparando Atualização'}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {updateReady 
                    ? 'Uma atualização do app está pronta. O app será atualizado automaticamente quando você sair.'
                    : 'Uma nova versão está sendo baixada em segundo plano...'
                  }
                </p>
                
                {updateReady && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUpdate}
                      size="sm"
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Atualizar Agora
                    </Button>
                    
                    <Button
                      onClick={dismissUpdate}
                      variant="ghost"
                      size="sm"
                    >
                      Depois
                    </Button>
                  </div>
                )}
              </div>
              
              {updateReady && (
                <Button
                  onClick={dismissUpdate}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
