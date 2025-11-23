import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Rate limiting configuration
const MAX_VALIDATIONS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const VALIDATION_COOLDOWN = 2000; // 2 seconds between validations

interface ValidationAttempt {
  timestamp: number;
}

interface ValidationResult {
  hasPremiumAccess: boolean;
  roles: string[];
  rateLimitReached?: boolean;
}

export const usePremiumValidation = () => {
  const { user } = useAuth();
  const [isValidating, setIsValidating] = useState(false);
  const attemptsRef = useRef<ValidationAttempt[]>([]);
  const lastValidationRef = useRef<number>(0);

  const cleanupOldAttempts = useCallback(() => {
    const now = Date.now();
    attemptsRef.current = attemptsRef.current.filter(
      attempt => now - attempt.timestamp < RATE_LIMIT_WINDOW
    );
  }, []);

  const checkRateLimit = useCallback((): boolean => {
    cleanupOldAttempts();
    
    const now = Date.now();
    const timeSinceLastValidation = now - lastValidationRef.current;

    // Check cooldown period
    if (timeSinceLastValidation < VALIDATION_COOLDOWN) {
      console.warn('[RATE-LIMIT] Cooldown period active');
      return false;
    }

    // Check rate limit
    if (attemptsRef.current.length >= MAX_VALIDATIONS_PER_MINUTE) {
      console.warn('[RATE-LIMIT] Maximum validations per minute reached');
      toast.error("Muitas tentativas. Aguarde um momento e tente novamente.");
      return false;
    }

    return true;
  }, [cleanupOldAttempts]);

  const recordAttempt = useCallback(() => {
    const now = Date.now();
    attemptsRef.current.push({ timestamp: now });
    lastValidationRef.current = now;
  }, []);

  const validatePremiumAccess = useCallback(async (): Promise<ValidationResult> => {
    if (!user) {
      return { hasPremiumAccess: false, roles: [] };
    }

    if (isValidating) {
      console.warn('[RATE-LIMIT] Validation already in progress');
      return { hasPremiumAccess: false, roles: [], rateLimitReached: true };
    }

    if (!checkRateLimit()) {
      return { hasPremiumAccess: false, roles: [], rateLimitReached: true };
    }

    setIsValidating(true);
    recordAttempt();

    try {
      console.log('[PREMIUM-VALIDATION] Starting validation for user:', user.id);

      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        console.error('[PREMIUM-VALIDATION] Error:', error);
        throw error;
      }

      const userRoles = (roles || []).map(r => r.role);
      const hasPremiumAccess = userRoles.includes('admin') || userRoles.includes('premium');

      console.log('[PREMIUM-VALIDATION] Result:', { hasPremiumAccess, roles: userRoles });

      return { hasPremiumAccess, roles: userRoles };
    } catch (error) {
      console.error('[PREMIUM-VALIDATION] Failed:', error);
      return { hasPremiumAccess: false, roles: [] };
    } finally {
      setIsValidating(false);
    }
  }, [user, isValidating, checkRateLimit, recordAttempt]);

  const getRateLimitStatus = useCallback(() => {
    cleanupOldAttempts();
    return {
      attemptsUsed: attemptsRef.current.length,
      attemptsRemaining: MAX_VALIDATIONS_PER_MINUTE - attemptsRef.current.length,
      maxAttempts: MAX_VALIDATIONS_PER_MINUTE,
      windowMs: RATE_LIMIT_WINDOW,
    };
  }, [cleanupOldAttempts]);

  return {
    validatePremiumAccess,
    isValidating,
    getRateLimitStatus,
  };
};
