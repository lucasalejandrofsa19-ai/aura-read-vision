import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WhitelistedIP {
  id: string;
  ip_address: string;
  description: string;
  added_by: string | null;
  added_at: string;
  expires_at: string | null;
  metadata: any;
  created_at: string;
}

export const useWhitelistedIPs = () => {
  const { user } = useAuth();
  const [whitelistedIPs, setWhitelistedIPs] = useState<WhitelistedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setWhitelistedIPs([]);
      setLoading(false);
      return;
    }

    fetchWhitelistedIPs();
  }, [user]);

  const fetchWhitelistedIPs = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('whitelisted_ips')
        .select('*')
        .order('added_at', { ascending: false });

      if (fetchError) throw fetchError;

      setWhitelistedIPs(data || []);
    } catch (err) {
      console.error('Error fetching whitelisted IPs:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const whitelistIP = async (
    ipAddress: string, 
    description: string, 
    expiresInDays?: number
  ): Promise<boolean> => {
    try {
      // Validate IP address format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(ipAddress)) {
        toast.error('Formato de IP inválido');
        return false;
      }

      const expiresAt = expiresInDays 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error: whitelistError } = await supabase
        .from('whitelisted_ips')
        .insert({
          ip_address: ipAddress,
          description,
          added_by: user?.id,
          expires_at: expiresAt,
          metadata: {
            manual_whitelist: true,
            expires_in_days: expiresInDays,
          },
        });

      if (whitelistError) throw whitelistError;

      toast.success(`IP ${ipAddress} adicionado à whitelist com sucesso`);
      await fetchWhitelistedIPs();
      return true;
    } catch (err) {
      console.error('Error whitelisting IP:', err);
      toast.error('Erro ao adicionar IP à whitelist');
      return false;
    }
  };

  const removeFromWhitelist = async (ipId: string): Promise<boolean> => {
    try {
      const { error: removeError } = await supabase
        .from('whitelisted_ips')
        .delete()
        .eq('id', ipId);

      if (removeError) throw removeError;

      toast.success('IP removido da whitelist com sucesso');
      await fetchWhitelistedIPs();
      return true;
    } catch (err) {
      console.error('Error removing from whitelist:', err);
      toast.error('Erro ao remover IP da whitelist');
      return false;
    }
  };

  const getStats = () => {
    const activeWhitelisted = whitelistedIPs.filter(
      ip => !ip.expires_at || new Date(ip.expires_at) > new Date()
    );
    const expiredWhitelisted = whitelistedIPs.filter(
      ip => ip.expires_at && new Date(ip.expires_at) <= new Date()
    );
    const permanentWhitelisted = whitelistedIPs.filter(ip => !ip.expires_at);

    return {
      total: whitelistedIPs.length,
      active: activeWhitelisted.length,
      expired: expiredWhitelisted.length,
      permanent: permanentWhitelisted.length,
    };
  };

  return {
    whitelistedIPs,
    loading,
    error,
    whitelistIP,
    removeFromWhitelist,
    refetch: fetchWhitelistedIPs,
    stats: getStats(),
  };
};
