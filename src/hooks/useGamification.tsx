import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface GamificationStats {
  user_id: string;
  xp_total: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  daily_goal_pages: number;
  freezes_available: number;
}

export interface DailyProgress {
  date: string;
  pages_read: number;
  xp_earned: number;
  goal_met: boolean;
}

export interface Achievement {
  code: string;
  name: string;
  description: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
  xp_reward: number;
  sort_order: number;
}

export interface UserAchievement {
  achievement_code: string;
  unlocked_at: string;
}

export const xpForLevel = (level: number) => Math.pow(level - 1, 2) * 50;
export const levelProgress = (xp: number, level: number) => {
  const curr = xpForLevel(level);
  const next = xpForLevel(level + 1);
  if (next === curr) return 0;
  return Math.min(100, Math.max(0, ((xp - curr) / (next - curr)) * 100));
};

export const useGamification = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lastLevelRef = useRef<number | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["gamification-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("gamification_stats")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) {
        const { data: created } = await supabase
          .from("gamification_stats")
          .insert({ user_id: user.id })
          .select()
          .single();
        return created as GamificationStats;
      }
      return data as GamificationStats;
    },
  });

  const { data: todayProgress } = useQuery({
    queryKey: ["daily-progress-today", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("daily_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      return (data || { date: today, pages_read: 0, xp_earned: 0, goal_met: false }) as DailyProgress;
    },
  });

  const { data: weekProgress = [] } = useQuery({
    queryKey: ["daily-progress-week", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const since = new Date();
      since.setDate(since.getDate() - 6);
      const { data } = await supabase
        .from("daily_progress")
        .select("date,pages_read,xp_earned,goal_met")
        .eq("user_id", user.id)
        .gte("date", since.toISOString().slice(0, 10))
        .order("date", { ascending: true });
      return (data || []) as DailyProgress[];
    },
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements-catalog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("achievements")
        .select("*")
        .order("sort_order", { ascending: true });
      return (data || []) as Achievement[];
    },
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ["user-achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_achievements")
        .select("achievement_code,unlocked_at")
        .eq("user_id", user.id);
      return (data || []) as UserAchievement[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["gamification-stats", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["daily-progress-today", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["daily-progress-week", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["user-achievements", user?.id] });
  };

  // Track level-ups and unlocks via simple diff
  const previousAchievementsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const codes = new Set(userAchievements.map((u) => u.achievement_code));
    if (previousAchievementsRef.current) {
      for (const code of codes) {
        if (!previousAchievementsRef.current.has(code)) {
          const ach = achievements.find((a) => a.code === code);
          if (ach) {
            toast({
              title: `🏆 Conquista desbloqueada!`,
              description: `${ach.name} — ${ach.description}${ach.xp_reward ? ` (+${ach.xp_reward} XP)` : ""}`,
              duration: 6000,
            });
          }
        }
      }
    }
    previousAchievementsRef.current = codes;
  }, [userAchievements, achievements, toast]);

  useEffect(() => {
    if (!stats) return;
    if (lastLevelRef.current !== null && stats.level > lastLevelRef.current) {
      toast({
        title: `⭐ Nível ${stats.level}!`,
        description: "Você subiu de nível. Continue assim!",
        duration: 5000,
      });
    }
    lastLevelRef.current = stats.level;
  }, [stats, toast]);

  const registerPagesRead = async (pages: number) => {
    if (!user || pages <= 0) return null;
    const { data, error } = await supabase.rpc("register_pages_read", { _pages: pages });
    if (error) return null;
    invalidateAll();
    const result = data as any;
    if (result?.goal_met_now) {
      toast({
        title: "🎯 Meta diária cumprida!",
        description: `+25 XP de bônus. Sequência mantida!`,
        duration: 5000,
      });
    }
    return result;
  };

  const awardActionXP = async (action: "highlight" | "note" | "book_completed") => {
    if (!user) return null;
    const { data, error } = await supabase.rpc("award_action_xp", { _action: action });
    if (error) return null;
    invalidateAll();
    return data;
  };

  const setDailyGoal = async (pages: number) => {
    if (!user) return;
    const { error } = await supabase.rpc("set_daily_goal", { _pages: pages });
    if (!error) {
      invalidateAll();
      toast({ title: "Meta atualizada", description: `Nova meta: ${pages} páginas/dia` });
    }
  };

  return {
    stats,
    todayProgress,
    weekProgress,
    achievements,
    userAchievements,
    registerPagesRead,
    awardActionXP,
    setDailyGoal,
  };
};
