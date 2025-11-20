import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "admin" | "premium" | "free";

export const useUserRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!user) {
        setRoles([]);
        setIsAdmin(false);
        setHasPremiumAccess(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) throw error;

        const userRoles = (data || []).map((r) => r.role as UserRole);
        setRoles(userRoles);
        
        const adminStatus = userRoles.includes("admin");
        setIsAdmin(adminStatus);
        
        const premiumStatus = adminStatus || userRoles.includes("premium");
        setHasPremiumAccess(premiumStatus);
      } catch (error) {
        console.error("Error fetching user roles:", error);
        setRoles([]);
        setIsAdmin(false);
        setHasPremiumAccess(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRoles();

    // Subscribe to changes in user_roles
    const channel = supabase
      .channel("user_roles_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchUserRoles();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  return {
    roles,
    isAdmin,
    hasPremiumAccess,
    loading,
  };
};
