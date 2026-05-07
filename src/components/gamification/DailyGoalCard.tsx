import { useState } from "react";
import { Flame, Star, Target, Trophy, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGamification, levelProgress, xpForLevel } from "@/hooks/useGamification";
import { Button } from "@/components/ui/button";
import { DailyGoalSetupDialog } from "./DailyGoalSetupDialog";

export const DailyGoalCard = () => {
  const { stats, todayProgress } = useGamification();
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const navigate = useNavigate();

  if (!stats || !todayProgress) return null;

  const goal = stats.daily_goal_pages;
  const pages = todayProgress.pages_read;
  const pct = Math.min(100, Math.round((pages / Math.max(1, goal)) * 100));
  const lvlPct = levelProgress(stats.xp_total, stats.level);
  const xpInLevel = stats.xp_total - xpForLevel(stats.level);
  const xpNeeded = xpForLevel(stats.level + 1) - xpForLevel(stats.level);

  // Circular progress
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="glass rounded-2xl p-4 mb-6 aura-soft">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Daily goal ring */}
        <div className="flex items-center gap-3">
          <div className="relative w-[90px] h-[90px] flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 90 90">
              <circle cx="45" cy="45" r={radius} className="stroke-muted" strokeWidth="6" fill="none" />
              <circle
                cx="45"
                cy="45"
                r={radius}
                className="stroke-primary"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="text-center">
              <div className="text-lg font-bold leading-none">{pages}</div>
              <div className="text-[10px] text-muted-foreground">/ {goal}</div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Target className="w-4 h-4 text-primary" /> Meta diária
            </div>
            <div className="text-xs text-muted-foreground">
              {todayProgress.goal_met ? "✓ Cumprida hoje!" : `Faltam ${Math.max(0, goal - pages)} páginas`}
            </div>
            <button
              onClick={() => setGoalDialogOpen(true)}
              className="text-[11px] text-primary mt-1 inline-flex items-center gap-1 hover:underline"
            >
              <Settings2 className="w-3 h-3" /> Ajustar meta
            </button>
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <Flame className={`w-6 h-6 ${stats.current_streak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
          <div>
            <div className="text-xl font-bold leading-none">{stats.current_streak}</div>
            <div className="text-[10px] text-muted-foreground">
              {stats.current_streak === 1 ? "dia" : "dias"} seguidos
            </div>
          </div>
        </div>

        {/* Level + XP */}
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Star className="w-4 h-4 text-yellow-500" />
              Nível {stats.level}
            </div>
            <div className="text-xs text-muted-foreground">
              {xpInLevel} / {xpNeeded} XP
            </div>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              style={{ width: `${lvlPct}%`, transition: "width 0.6s ease" }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            +{todayProgress.xp_earned} XP hoje · {stats.xp_total} XP total
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/conquistas")}
          className="aura-soft"
        >
          <Trophy className="w-4 h-4 mr-2" />
          Conquistas
        </Button>
      </div>

      <DailyGoalSetupDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        currentGoal={goal}
      />
    </div>
  );
};
