import { useState, useEffect } from "react";
import { invalidateUserProfile } from "@/lib/userProfileQuery";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const usePerformanceMode = () => {
  const { user } = useAuth();
  const { profile, isLoading } = useUserData();
  const queryClient = useQueryClient();
  const [isUltraPerformanceMode, setIsUltraPerformanceMode] = useState(false);

  useEffect(() => {
    if (profile) {
      setIsUltraPerformanceMode(!!profile.ultra_performance_mode);
    }
  }, [profile?.ultra_performance_mode]);

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
      invalidateUserProfile(queryClient, user.id);

      toast.success(
        newValue
          ? "Modo Ultra Performance ativado - Animações desabilitadas"
          : "Modo Ultra Performance desativado - Animações ativadas"
      );
    } catch (error) {
      console.error("Error saving performance mode:", error);
      setIsUltraPerformanceMode(!newValue);
      toast.error("Erro ao salvar configuração");
    }
  };

  return {
    isUltraPerformanceMode,
    togglePerformanceMode,
    loading: isLoading,
  };
};
