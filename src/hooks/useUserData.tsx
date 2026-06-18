import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserProfile, userProfileQueryKey } from "@/lib/userProfileQuery";

export const useUserData = () => {
  const { user } = useAuth();

  // Fetch user roles with cache
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;
      return (data || []).map((r) => r.role as string);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  // Fetch user profile with cache
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: user ? userProfileQueryKey(user.id) : ["user-profile", "anon"],
    queryFn: async () => {
      if (!user) return null;
      return fetchUserProfile(user.id);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const roles = rolesData || [];
  const isAdmin = roles.includes("admin");
  const hasPremiumAccess = isAdmin || roles.includes("premium");

  return {
    roles,
    isAdmin,
    hasPremiumAccess,
    profile: profileData,
    isLoading: rolesLoading || profileLoading,
  };
};
