import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { ArrowLeft, Users, BookOpen, TrendingUp, Shield, Star, UserCheck } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { SEO } from "@/components/SEO";

interface Analytics {
  totalUsers: number;
  totalBooks: number;
  activeUsers: number;
  roleDistribution: { role: string; count: number }[];
  monthlyGrowth: { month: string; users: number }[];
}

const COLORS = {
  admin: "hsl(var(--destructive))",
  premium: "hsl(var(--primary))",
  free: "hsl(var(--muted-foreground))",
};

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useUserRole();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página",
        variant: "destructive",
      });
      navigate("/library");
    }
  }, [isAdmin, loading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics();
    }
  }, [isAdmin]);

  const fetchAnalytics = async () => {
    setLoadingData(true);
    try {
      // Total de usuários
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Total de livros
      const { count: totalBooks } = await supabase
        .from("books")
        .select("*", { count: "exact", head: true });

      // Usuários ativos (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: activeUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("updated_at", thirtyDaysAgo.toISOString());

      // Distribuição de roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role");

      const roleDistribution = [
        { role: "admin", count: 0 },
        { role: "premium", count: 0 },
        { role: "free", count: 0 },
      ];

      rolesData?.forEach((item) => {
        const roleItem = roleDistribution.find((r) => r.role === item.role);
        if (roleItem) roleItem.count++;
      });

      // Usuários sem role (free por padrão)
      const usersWithRoles = new Set(rolesData?.map((r) => r.role));
      roleDistribution.find((r) => r.role === "free")!.count += (totalUsers || 0) - (rolesData?.length || 0);

      // Crescimento mensal (últimos 6 meses)
      const { data: usersData } = await supabase
        .from("profiles")
        .select("created_at")
        .order("created_at", { ascending: true });

      const monthlyGrowth: { month: string; users: number }[] = [];
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthIndex = date.getMonth();
        const year = date.getFullYear();
        
        const usersInMonth = usersData?.filter((user) => {
          const userDate = new Date(user.created_at || "");
          return userDate.getMonth() === monthIndex && userDate.getFullYear() === year;
        }).length || 0;

        monthlyGrowth.push({
          month: `${months[monthIndex]}/${year.toString().slice(2)}`,
          users: usersInMonth,
        });
      }

      setAnalytics({
        totalUsers: totalUsers || 0,
        totalBooks: totalBooks || 0,
        activeUsers: activeUsers || 0,
        roleDistribution,
        monthlyGrowth,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as estatísticas",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Analytics admin — AURA READ" description="Dashboard interno de métricas e analytics da AURA READ." path="/admin/analytics" noindex />
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass border-b border-border/50 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Estatísticas e métricas do aplicativo
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="glass p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Usuários</p>
                  <p className="text-3xl font-bold mt-2">{analytics?.totalUsers}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="glass p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Usuários Ativos</p>
                  <p className="text-3xl font-bold mt-2">{analytics?.activeUsers}</p>
                  <p className="text-xs text-muted-foreground mt-1">Últimos 30 dias</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Livros</p>
                  <p className="text-3xl font-bold mt-2">{analytics?.totalBooks}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-accent" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="glass p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Ativação</p>
                  <p className="text-3xl font-bold mt-2">
                    {analytics?.totalUsers ? Math.round((analytics.activeUsers / analytics.totalUsers) * 100) : 0}%
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribuição de Roles */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="glass p-6">
              <h2 className="text-xl font-bold mb-6">Distribuição de Roles</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics?.roleDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ role, count, percent }) => `${role}: ${count} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics?.roleDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.role as keyof typeof COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-destructive" />
                  <span className="text-sm">Admin</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  <span className="text-sm">Premium</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Free</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Crescimento Mensal */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card className="glass p-6">
              <h2 className="text-xl font-bold mb-6">Crescimento Mensal de Usuários</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics?.monthlyGrowth}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="users" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Trend Line */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="glass p-6">
            <h2 className="text-xl font-bold mb-6">Tendência de Novos Usuários</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics?.monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="users" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminAnalytics;
