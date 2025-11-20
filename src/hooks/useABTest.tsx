import { useState, useEffect } from "react";

export interface ABTestVariant {
  id: string;
  name: string;
  weight?: number; // Peso para distribuição (padrão: igual para todos)
}

export const useABTest = (testName: string, variants: ABTestVariant[]) => {
  const [selectedVariant, setSelectedVariant] = useState<string>("");

  useEffect(() => {
    const storageKey = `ab_test_${testName}`;
    
    // Verificar se já existe uma variante selecionada
    const savedVariant = localStorage.getItem(storageKey);
    
    if (savedVariant && variants.some(v => v.id === savedVariant)) {
      setSelectedVariant(savedVariant);
    } else {
      // Selecionar variante aleatória baseada nos pesos
      const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 1), 0);
      let random = Math.random() * totalWeight;
      
      let selected = variants[0].id;
      for (const variant of variants) {
        random -= variant.weight || 1;
        if (random <= 0) {
          selected = variant.id;
          break;
        }
      }
      
      setSelectedVariant(selected);
      localStorage.setItem(storageKey, selected);
      
      // Rastrear exposição à variante
      const exposuresKey = `ab_exposures_${testName}`;
      const exposures = JSON.parse(localStorage.getItem(exposuresKey) || "{}");
      exposures[selected] = (exposures[selected] || 0) + 1;
      localStorage.setItem(exposuresKey, JSON.stringify(exposures));
    }
  }, [testName, variants]);

  const trackConversion = (variantId?: string) => {
    const variant = variantId || selectedVariant;
    const conversionsKey = `ab_conversions_${testName}`;
    const conversions = JSON.parse(localStorage.getItem(conversionsKey) || "{}");
    conversions[variant] = (conversions[variant] || 0) + 1;
    localStorage.setItem(conversionsKey, JSON.stringify(conversions));
    
    // Registrar timestamp da conversão
    const timestampKey = `ab_conversion_time_${testName}_${variant}`;
    localStorage.setItem(timestampKey, new Date().toISOString());
  };

  const getStats = () => {
    const exposuresKey = `ab_exposures_${testName}`;
    const conversionsKey = `ab_conversions_${testName}`;
    
    const exposures = JSON.parse(localStorage.getItem(exposuresKey) || "{}");
    const conversions = JSON.parse(localStorage.getItem(conversionsKey) || "{}");
    
    return variants.map(variant => ({
      id: variant.id,
      name: variant.name,
      exposures: exposures[variant.id] || 0,
      conversions: conversions[variant.id] || 0,
      conversionRate: exposures[variant.id] 
        ? ((conversions[variant.id] || 0) / exposures[variant.id] * 100).toFixed(2)
        : "0.00"
    }));
  };

  return {
    selectedVariant,
    trackConversion,
    getStats
  };
};
