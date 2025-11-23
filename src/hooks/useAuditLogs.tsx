import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  feature: string;
  ip_address: string | null;
  user_agent: string | null;
  granted: boolean;
  reason: string | null;
  metadata: any;
  created_at: string;
}

interface UseAuditLogsOptions {
  limit?: number;
  feature?: string;
  startDate?: Date;
  endDate?: Date;
}

export const useAuditLogs = (options: UseAuditLogsOptions = {}) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { limit = 100, feature, startDate, endDate } = options;

  useEffect(() => {
    if (!user) {
      setLogs([]);
      setLoading(false);
      return;
    }

    fetchAuditLogs();
  }, [user, limit, feature, startDate, endDate]);

  const fetchAuditLogs = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('premium_access_audit')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (feature) {
        query = query.eq('feature', feature);
      }

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getStats = () => {
    const totalAttempts = logs.length;
    const granted = logs.filter(log => log.granted).length;
    const denied = logs.filter(log => !log.granted).length;
    const byFeature = logs.reduce((acc, log) => {
      acc[log.feature] = (acc[log.feature] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAttempts,
      granted,
      denied,
      grantRate: totalAttempts > 0 ? (granted / totalAttempts) * 100 : 0,
      byFeature,
    };
  };

  const getSuspiciousActivity = () => {
    // Detect patterns that might indicate suspicious activity
    const ipCounts = logs.reduce((acc, log) => {
      if (log.ip_address) {
        acc[log.ip_address] = (acc[log.ip_address] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const suspiciousIPs = Object.entries(ipCounts)
      .filter(([_, count]) => count > 20) // More than 20 attempts from same IP
      .map(([ip, count]) => ({ ip, count }));

    const rateLimitViolations = logs.filter(
      log => log.reason === 'rate_limit_exceeded'
    ).length;

    return {
      suspiciousIPs,
      rateLimitViolations,
      hasSuspiciousActivity: suspiciousIPs.length > 0 || rateLimitViolations > 5,
    };
  };

  return {
    logs,
    loading,
    error,
    refetch: fetchAuditLogs,
    stats: getStats(),
    suspiciousActivity: getSuspiciousActivity(),
  };
};
