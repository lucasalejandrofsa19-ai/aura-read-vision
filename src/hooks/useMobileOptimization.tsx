import { useEffect, useState } from "react";
import { useIsMobile } from "./use-mobile";

interface MobileOptimizationConfig {
  isMobile: boolean;
  shouldReduceAnimations: boolean;
  shouldReduceEffects: boolean;
  pdfScale: number;
  imageQuality: number;
}

export const useMobileOptimization = (): MobileOptimizationConfig => {
  const isMobile = useIsMobile();
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
    
    setConfig({
      isMobile,
      shouldReduceAnimations: isLowPerformance,
      shouldReduceEffects: isLowPerformance,
      pdfScale: isMobile ? 0.8 : 1.0, // Reduz escala do PDF em mobile
      imageQuality: isMobile ? 0.8 : 1.0,
    });
  }, [isMobile]);

  return config;
};
