import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// SECURITY WARNING: This cache is ONLY for UI display purposes (showing/hiding features)
// NEVER use this cache alone to authorize premium operations
// All premium operations MUST validate directly from database/server
interface CachedPremiumAccess {
  hasPremiumAccess: boolean;
  roles: string[];
  timestamp: number;
}

const CACHE_KEY = "premium_access_cache";
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (reduced for security)

export const usePremiumAccessCache = () => {
  const { user } = useAuth();
  const [hasPremiumAccess, setHasPremiumAccess] = useState<boolean | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const getCachedData = useCallback((): CachedPremiumAccess | null => {
    if (!user) return null;

    try {
      const cached = localStorage.getItem(`${CACHE_KEY}_${user.id}`);
      if (!cached) return null;

      const data: CachedPremiumAccess = JSON.parse(cached);
      const now = Date.now();

      // Verifica se o cache ainda é válido (menos de 5 minutos)
      if (now - data.timestamp < CACHE_DURATION) {
        return data;
      }

      // Cache expirado, remove
      localStorage.removeItem(`${CACHE_KEY}_${user.id}`);
      return null;
    } catch (error) {
      console.error("Error reading cache:", error);
      return null;
    }
  }, [user]);

  const setCachedData = useCallback((hasPremium: boolean, userRoles: string[]) => {
    if (!user) return;

    try {
      const data: CachedPremiumAccess = {
        hasPremiumAccess: hasPremium,
        roles: userRoles,
        timestamp: Date.now(),
      };
      localStorage.setItem(`${CACHE_KEY}_${user.id}`, JSON.stringify(data));
    } catch (error) {
      console.error("Error setting cache:", error);
    }
  }, [user]);

  const invalidateCache = useCallback(() => {
    if (!user) return;
    
    try {
      localStorage.removeItem(`${CACHE_KEY}_${user.id}`);
      console.log("[PREMIUM-CACHE] Cache invalidated");
    } catch (error) {
      console.error("Error invalidating cache:", error);
    }
  }, [user]);

  const verifyPremiumAccess = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setHasPremiumAccess(false);
      setRoles([]);
      setLoading(false);
      return { hasPremiumAccess: false, roles: [] };
    }

    // Se não forçar refresh, tenta usar cache
    if (!forceRefresh) {
      const cached = getCachedData();
      if (cached) {
        console.log("[PREMIUM-CACHE] Using cached data");
        setHasPremiumAccess(cached.hasPremiumAccess);
        setRoles(cached.roles);
        setLoading(false);
        return cached;
      }
    }

    setLoading(true);
    console.log("[PREMIUM-CACHE] Fetching from server");

    try {
      const { data, error } = await supabase.functions.invoke('verify-premium-access');

      if (error) throw error;

      const hasPremium = data?.hasPremiumAccess || false;
      const userRoles = data?.roles || [];

      // Salva no cache
      setCachedData(hasPremium, userRoles);

      setHasPremiumAccess(hasPremium);
      setRoles(userRoles);
      
      return { hasPremiumAccess: hasPremium, roles: userRoles };
    } catch (error) {
      console.error("[PREMIUM-CACHE] Error verifying premium access:", error);
      setHasPremiumAccess(false);
      setRoles([]);
      return { hasPremiumAccess: false, roles: [] };
    } finally {
      setLoading(false);
    }
  }, [user, getCachedData, setCachedData]);

  useEffect(() => {
    verifyPremiumAccess();
  }, [user]);

  return {
    hasPremiumAccess,
    roles,
    loading,
    verifyPremiumAccess,
    invalidateCache,
  };
};
