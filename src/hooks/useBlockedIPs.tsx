import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_by: string | null;
  blocked_at: string;
  blocked_until: string | null;
  auto_blocked: boolean;
  metadata: any;
  created_at: string;
  reputation_score: number | null;
  reputation_data: any;
  is_threat: boolean;
  threat_categories: string[] | null;
}

export const useBlockedIPs = () => {
  const { user } = useAuth();
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setBlockedIPs([]);
      setLoading(false);
      return;
    }

    fetchBlockedIPs();
  }, [user]);

  const fetchBlockedIPs = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('blocked_ips')
        .select('*')
        .order('blocked_at', { ascending: false });

      if (fetchError) throw fetchError;

      setBlockedIPs(data || []);
    } catch (err) {
      console.error('Error fetching blocked IPs:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const blockIP = async (
    ipAddress: string, 
    reason: string, 
    durationHours?: number
  ): Promise<boolean> => {
    try {
      const blockedUntil = durationHours 
        ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
        : null;

      const { error: blockError } = await supabase
        .from('blocked_ips')
        .insert({
          ip_address: ipAddress,
          reason,
          blocked_by: user?.id,
          blocked_until: blockedUntil,
          auto_blocked: false,
          metadata: {
            manual_block: true,
            duration_hours: durationHours,
          },
        });

      if (blockError) throw blockError;

      toast.success(`IP ${ipAddress} bloqueado com sucesso`);
      await fetchBlockedIPs();
      return true;
    } catch (err) {
      console.error('Error blocking IP:', err);
      toast.error('Erro ao bloquear IP');
      return false;
    }
  };

  const unblockIP = async (ipId: string): Promise<boolean> => {
    try {
      const { error: unblockError } = await supabase
        .from('blocked_ips')
        .delete()
        .eq('id', ipId);

      if (unblockError) throw unblockError;

      toast.success('IP desbloqueado com sucesso');
      await fetchBlockedIPs();
      return true;
    } catch (err) {
      console.error('Error unblocking IP:', err);
      toast.error('Erro ao desbloquear IP');
      return false;
    }
  };

  const checkAutoBlock = async (ipAddress: string, reason: 'rate_limit' | 'high_volume' | 'failed_attempts') => {
    try {
      const { data, error } = await supabase.functions.invoke('auto-block-ip', {
        body: {
          ipAddress,
          userId: user?.id,
          reason,
        },
      });

      if (error) throw error;

      if (data?.blocked) {
        await fetchBlockedIPs();
        return true;
      }

      return false;
    } catch (err) {
      console.error('Error checking auto-block:', err);
      return false;
    }
  };

  const checkReputation = async (ipAddress: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-ip-reputation', {
        body: { ipAddress, maxAgeInDays: 90 },
      });

      if (error) throw error;

      return data?.reputation;
    } catch (err) {
      console.error('Error checking reputation:', err);
      return null;
    }
  };

  const getStats = () => {
    const activeBlocks = blockedIPs.filter(
      ip => !ip.blocked_until || new Date(ip.blocked_until) > new Date()
    );
    const expiredBlocks = blockedIPs.filter(
      ip => ip.blocked_until && new Date(ip.blocked_until) <= new Date()
    );
    const autoBlocked = blockedIPs.filter(ip => ip.auto_blocked);
    const manualBlocked = blockedIPs.filter(ip => !ip.auto_blocked);
    const threatIPs = blockedIPs.filter(ip => ip.is_threat);
    const highRiskIPs = blockedIPs.filter(ip => (ip.reputation_score || 0) >= 75);

    return {
      total: blockedIPs.length,
      active: activeBlocks.length,
      expired: expiredBlocks.length,
      autoBlocked: autoBlocked.length,
      manualBlocked: manualBlocked.length,
      threats: threatIPs.length,
      highRisk: highRiskIPs.length,
    };
  };

  return {
    blockedIPs,
    loading,
    error,
    blockIP,
    unblockIP,
    checkAutoBlock,
    checkReputation,
    refetch: fetchBlockedIPs,
    stats: getStats(),
  };
};
