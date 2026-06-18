import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserData } from "@/hooks/useUserData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type ThemeType = "safira" | "sepia" | "noturno" | "contraste";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeType>("safira");
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from user profile with cache
  useEffect(() => {
    const loadTheme = async () => {
      if (!user) {
        // Use local storage for non-authenticated users
        const savedTheme = localStorage.getItem("theme") as ThemeType;
        if (savedTheme) {
          setThemeState(savedTheme);
          applyTheme(savedTheme);
        }
        setIsLoading(false);
        return;
      }

      // Verificar cache primeiro
      const cacheKey = `theme_${user.id}`;
      const cachedTheme = sessionStorage.getItem(cacheKey);
      
      if (cachedTheme) {
        const theme = cachedTheme as ThemeType;
        setThemeState(theme);
        applyTheme(theme);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("theme_preference")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        const userTheme = (data?.theme_preference as ThemeType) || "safira";
        setThemeState(userTheme);
        applyTheme(userTheme);
        
        // Salvar no cache da sessão
        sessionStorage.setItem(cacheKey, userTheme);
      } catch (error) {
        console.error("Error loading theme:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, [user]);

  const applyTheme = (newTheme: ThemeType) => {
    // Remove all theme classes
    document.documentElement.classList.remove(
      "theme-safira",
      "theme-sepia",
      "theme-noturno",
      "theme-contraste"
    );
    // Add new theme class
    document.documentElement.classList.add(`theme-${newTheme}`);
  };

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    applyTheme(newTheme);

    if (!user) {
      // Save to local storage for non-authenticated users
      localStorage.setItem("theme", newTheme);
      return;
    }

    // Atualizar cache imediatamente
    const cacheKey = `theme_${user.id}`;
    sessionStorage.setItem(cacheKey, newTheme);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ theme_preference: newTheme })
        .eq("id", user.id);

      if (error) throw error;
      
      toast.success("Tema salvo com sucesso!");
    } catch (error) {
      console.error("Error saving theme:", error);
      toast.error("Erro ao salvar tema");
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};
