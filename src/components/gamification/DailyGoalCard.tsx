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
    <div className="relative rounded-2xl border border-border/60 bg-card shadow-lg shadow-background/40 p-5 overflow-hidden">
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-display font-semibold tracking-tight">Meta diária</h3>
          </div>
          <button
            onClick={() => setGoalDialogOpen(true)}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <Settings2 className="w-3 h-3" /> Ajustar
          </button>
        </div>

        {/* Ring + label */}
        <div className="flex items-center gap-4">
          <div className="relative w-[88px] h-[88px] flex items-center justify-center shrink-0">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 90 90">
              <circle cx="45" cy="45" r={radius} className="stroke-muted/60" strokeWidth="6" fill="none" />
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
              <div className="text-xl font-display font-bold leading-none tabular-nums">{pages}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">/ {goal} pg</div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">
              {todayProgress.goal_met ? "Meta cumprida hoje" : `Faltam ${Math.max(0, goal - pages)} páginas`}
            </div>
            <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
              <Flame className={`w-4 h-4 ${stats.current_streak > 0 ? "text-accent" : "text-muted-foreground"}`} />
              <div className="leading-none">
                <span className="text-sm font-display font-bold tabular-nums">{stats.current_streak}</span>
                <span className="text-[10px] text-muted-foreground ml-1">
                  {stats.current_streak === 1 ? "dia" : "dias"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Level + XP */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Star className="w-3.5 h-3.5 text-accent" />
              Nível {stats.level}
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {xpInLevel} / {xpNeeded} XP
            </div>
          </div>
          <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              style={{ width: `${lvlPct}%`, transition: "width 0.6s ease" }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5">
            +{todayProgress.xp_earned} XP hoje · {stats.xp_total} XP total
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/conquistas")}
          className="w-full border-border/60 hover:bg-primary/5 hover:border-primary/40"
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
