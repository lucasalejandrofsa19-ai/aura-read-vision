import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Clock, Trophy, TrendingUp, Flame, BookCheck } from "lucide-react";
import { useReadingStats } from "@/hooks/useReadingStats";
import { motion } from "framer-motion";

export const ReadingStatsCard = () => {
  const { stats, loading } = useReadingStats();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      icon: BookOpen,
      label: "Páginas Lidas",
      value: stats.totalPagesRead.toLocaleString(),
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Clock,
      label: "Tempo Médio",
      value: `${stats.averageReadingTime} min`,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      icon: Trophy,
      label: "Livros Completos",
      value: stats.completedBooks.toString(),
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    {
      icon: TrendingUp,
      label: "Em Progresso",
      value: stats.booksInProgress.toString(),
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      icon: Flame,
      label: "Sequência Atual",
      value: `${stats.currentStreak} dias`,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      icon: BookCheck,
      label: "Total de Livros",
      value: stats.totalBooksRead.toString(),
      color: "text-pink-500",
      bg: "bg-pink-500/10",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Estatísticas de Leitura
        </CardTitle>
        <CardDescription>
          Acompanhe seu progresso e conquistas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {statItems.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
            >
              <div className={`p-3 rounded-full ${item.bg} mb-3`}>
                <item.icon className={`w-6 h-6 ${item.color}`} />
              </div>
              <p className="text-2xl font-bold mb-1">{item.value}</p>
              <p className="text-xs text-muted-foreground text-center">{item.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Additional Stats */}
        <div className="mt-6 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Tempo Total de Leitura</span>
            <span className="text-sm font-semibold">
              {Math.floor(stats.totalReadingTime / 60)}h {stats.totalReadingTime % 60}min
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Maior Sequência</span>
            <span className="text-sm font-semibold">
              {stats.longestStreak} dias
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
