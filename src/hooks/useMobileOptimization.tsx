import { useEffect, useState } from "react";
import { useIsMobile } from "./use-mobile";
import { usePerformanceMode } from "./usePerformanceMode";

interface MobileOptimizationConfig {
  isMobile: boolean;
  shouldReduceAnimations: boolean;
  shouldReduceEffects: boolean;
  pdfScale: number;
  imageQuality: number;
}

export const useMobileOptimization = (): MobileOptimizationConfig => {
  const isMobile = useIsMobile();
  const { isUltraPerformanceMode, loading } = usePerformanceMode();
  const [config, setConfig] = useState<MobileOptimizationConfig>({
    isMobile: false,
    shouldReduceAnimations: false,
    shouldReduceEffects: false,
    pdfScale: 1.0,
    imageQuality: 1.0,
  });

  useEffect(() => {
    // Detecta se é mobile ou dispositivo com baixo desempenho
    const isLowPerformance = isMobile || navigator.hardwareConcurrency <= 4;
    
    // Se modo ultra performance está ativo, força todas as otimizações
    const forceOptimizations = isUltraPerformanceMode;
    
    setConfig({
      isMobile,
      shouldReduceAnimations: forceOptimizations || isLowPerformance,
      shouldReduceEffects: forceOptimizations || isLowPerformance,
      pdfScale: forceOptimizations || isMobile ? 0.8 : 1.0,
      imageQuality: forceOptimizations || isMobile ? 0.8 : 1.0,
    });
  }, [isMobile, isUltraPerformanceMode, loading]);

  return config;
};
