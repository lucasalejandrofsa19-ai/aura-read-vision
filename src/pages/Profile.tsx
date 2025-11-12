import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Book, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";

const stats = [
  {
    icon: Book,
    label: "Livros Lidos",
    value: "12",
    color: "text-primary",
  },
  {
    icon: Clock,
    label: "Horas de Leitura",
    value: "48h",
    color: "text-accent",
  },
  {
    icon: Award,
    label: "Marcações",
    value: "156",
    color: "text-primary",
  },
];

const recentActivity = [
  { book: "O Poder do Agora", action: "Destacou 3 trechos", time: "2 horas atrás" },
  { book: "Sapiens", action: "Terminou capítulo 5", time: "1 dia atrás" },
  { book: "Atomic Habits", action: "Adicionou marcador", time: "2 dias atrás" },
];

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 mb-8 aura-soft"
      >
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/library")}
            className="aura-soft transition-aura"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Meu Perfil
          </h1>
        </div>

        {/* Profile info */}
        <div className="flex items-center gap-6">
          <Avatar className="w-24 h-24 border-2 border-primary aura-safira">
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-2xl">
              {user?.email ? getInitials(user.email) : "US"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">{user?.user_metadata?.full_name || "Usuário"}</h2>
            <p className="text-muted-foreground">{user?.email}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Membro desde {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Recentemente'}
            </p>
          </div>
        </div>
      </motion.header>

      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6 mb-8">
        {/* Stats */}
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass rounded-xl p-6 text-center aura-soft transition-aura hover:aura-safira cursor-pointer"
          >
            <stat.icon className={`w-8 h-8 ${stat.color} mx-auto mb-3`} />
            <p className="text-3xl font-bold mb-1">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="max-w-4xl mx-auto glass rounded-2xl p-6 aura-soft"
      >
        <h3 className="text-xl font-bold mb-6">Atividade Recente</h3>
        <div className="space-y-4">
          {recentActivity.map((activity, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="flex justify-between items-center py-3 border-b border-border last:border-0"
            >
              <div>
                <p className="font-medium">{activity.book}</p>
                <p className="text-sm text-muted-foreground">{activity.action}</p>
              </div>
              <span className="text-xs text-muted-foreground">{activity.time}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;