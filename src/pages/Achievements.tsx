import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Flame, Star, Target, BookOpen, Book, Library, LibraryBig, Crown, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGamification, levelProgress, xpForLevel } from "@/hooks/useGamification";

const ICONS: Record<string, any> = {
  trophy: Trophy,
  flame: Flame,
  star: Star,
  target: Target,
  "book-open": BookOpen,
  book: Book,
  library: Library,
  "library-big": LibraryBig,
  crown: Crown,
  sparkles: Sparkles,
};

const Achievements = () => {
  const navigate = useNavigate();
  const { stats, achievements, userAchievements, weekProgress, todayProgress } = useGamification();

  const unlockedSet = new Set(userAchievements.map((u) => u.achievement_code));

  const last7 = (() => {
    const days: { date: string; pages: number; goal_met: boolean; label: string }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const found = weekProgress.find((p) => p.date === iso);
      days.push({
        date: iso,
        pages: found?.pages_read || 0,
        goal_met: found?.goal_met || false,
        label: ["D", "S", "T", "Q", "Q", "S", "S"][d.getDay()],
      });
    }
    return days;
  })();

  const maxPages = Math.max(1, ...last7.map((d) => d.pages));
  const goal = stats?.daily_goal_pages || 10;

  return (
    <>
    <SEO
      title="Conquistas — AURA READ"
      description="Acompanhe suas conquistas, XP e streaks de leitura na AURA READ."
      path="/conquistas"
    />
    <div className="min-h-screen p-6 bg-gradient-to-b from-background via-background to-muted/20">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Conquistas e Progresso
          </h1>
        </div>

        {stats && (
          <div className="glass rounded-2xl p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Nível" value={stats.level} icon={<Star className="w-5 h-5 text-yellow-500" />} />
            <Stat label="XP total" value={stats.xp_total} icon={<Sparkles className="w-5 h-5 text-primary" />} />
            <Stat
              label="Sequência atual"
              value={`${stats.current_streak} ${stats.current_streak === 1 ? "dia" : "dias"}`}
              icon={<Flame className="w-5 h-5 text-orange-500" />}
            />
            <Stat
              label="Maior sequência"
              value={`${stats.longest_streak} ${stats.longest_streak === 1 ? "dia" : "dias"}`}
              icon={<Crown className="w-5 h-5 text-amber-500" />}
            />
          </div>
        )}

        {/* Weekly chart */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Últimos 7 dias</h2>
          <div className="flex items-end justify-between gap-2 h-40">
            {last7.map((d, i) => {
              const h = (d.pages / maxPages) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] font-semibold">{d.pages}</div>
                  <div className="w-full h-32 bg-muted/30 rounded-md flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-md transition-all ${
                        d.goal_met ? "bg-gradient-to-t from-primary to-accent" : "bg-muted-foreground/40"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{d.label}</div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Barras coloridas = dias em que você bateu a meta de {goal} páginas
          </p>
        </div>

        {/* Achievements grid */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Conquistas ({unlockedSet.size}/{achievements.length})
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {achievements.map((ach) => {
            const Icon = ICONS[ach.icon] || Trophy;
            const unlocked = unlockedSet.has(ach.code);
            return (
              <div
                key={ach.code}
                className={`rounded-2xl p-4 border-2 transition-all ${
                  unlocked
                    ? "glass border-primary/40 aura-soft"
                    : "bg-muted/20 border-border/50 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      unlocked
                        ? "bg-gradient-to-br from-primary to-accent text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {unlocked ? <Icon className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{ach.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{ach.description}</div>
                    {ach.xp_reward > 0 && (
                      <div className="text-[10px] text-primary mt-1 font-semibold">+{ach.xp_reward} XP</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">{icon}</div>
    <div>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  </div>
);

export default Achievements;
