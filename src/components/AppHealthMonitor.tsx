import { useAppHealth } from '@/hooks/useAppHealth';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

export const AppHealthMonitor = () => {
  const { hasIssues, errorCount, clearCacheAndReload, resetErrorCount } = useAppHealth();
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <AnimatePresence>
        {hasIssues && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50"
          >
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg shadow-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-destructive/20">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground mb-1">
                    Problemas Detectados
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Encontramos {errorCount} erro(s) recentes. Isso pode indicar problemas com a última atualização.
                  </p>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowDialog(true)}
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Limpar Cache
                    </Button>
                    
                    <Button
                      onClick={resetErrorCount}
                      variant="ghost"
                      size="sm"
                    >
                      Ignorar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar Cache e Recarregar?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Limpar todo o cache do aplicativo</li>
                <li>Remover service workers instalados</li>
                <li>Recarregar a página com arquivos atualizados</li>
              </ul>
              <p className="mt-3 font-medium">
                Isso geralmente resolve problemas após atualizações.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={clearCacheAndReload}>
              Limpar e Recarregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
