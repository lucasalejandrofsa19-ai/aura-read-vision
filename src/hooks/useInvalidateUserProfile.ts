import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { invalidateUserProfile } from "@/lib/userProfileQuery";

/**
 * Returns a function that invalidates the cached user profile for the
 * currently authenticated user. No-op when there is no user.
 */
export const useInvalidateUserProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useCallback(async () => {
    if (!user) return;
    await invalidateUserProfile(queryClient, user.id);
  }, [queryClient, user]);
};
