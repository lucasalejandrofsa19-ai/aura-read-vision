import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const usePerformanceMode = () => {
  const { user } = useAuth();
  const [isUltraPerformanceMode, setIsUltraPerformanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load performance mode preference from profile
  useEffect(() => {
    const loadPreference = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("ultra_performance_mode")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setIsUltraPerformanceMode(data.ultra_performance_mode || false);
        }
      } catch (error) {
        console.error("Error loading performance mode:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPreference();
  }, [user]);

  // Toggle performance mode and save to database
  const togglePerformanceMode = async () => {
    if (!user) {
      toast.error("Faça login para alterar esta configuração");
      return;
    }

    const newValue = !isUltraPerformanceMode;
    setIsUltraPerformanceMode(newValue);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ultra_performance_mode: newValue })
        .eq("id", user.id);

      if (error) throw error;

      toast.success(
        newValue
          ? "Modo Ultra Performance ativado - Animações desabilitadas"
          : "Modo Ultra Performance desativado - Animações ativadas"
      );
    } catch (error) {
      console.error("Error saving performance mode:", error);
      setIsUltraPerformanceMode(!newValue); // Revert on error
      toast.error("Erro ao salvar configuração");
    }
  };

  return {
    isUltraPerformanceMode,
    togglePerformanceMode,
    loading,
  };
};
