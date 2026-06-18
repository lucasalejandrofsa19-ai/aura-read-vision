import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { userProfileQueryKey } from "@/lib/userProfileQuery";
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
  const { profile, isLoading: profileLoading } = useUserData();
  const queryClient = useQueryClient();
  const [theme, setThemeState] = useState<ThemeType>("safira");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      const savedTheme = localStorage.getItem("theme") as ThemeType;
      if (savedTheme) {
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      }
      setIsLoading(false);
      return;
    }
    if (profileLoading) return;
    const userTheme = (profile?.theme_preference as ThemeType) || "safira";
    setThemeState(userTheme);
    applyTheme(userTheme);
    setIsLoading(false);
  }, [user, profileLoading, profile?.theme_preference]);


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

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ theme_preference: newTheme })
        .eq("id", user.id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: userProfileQueryKey(user.id) });

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
