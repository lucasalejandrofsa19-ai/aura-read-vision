import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Shield, Users, ArrowLeft, Crown, Star } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading } = useUserRole();
  const { toast } = useToast();
  
  const [targetEmail, setTargetEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "premium" | "free">("premium");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
      fetchAllUsers();
    }
  }, [isAdmin]);

  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name");

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        roles: roles?.filter(r => r.user_id === profile.id).map(r => r.role) || []
      })) || [];

      setAllUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const assignRole = async () => {
    if (!targetEmail) {
      toast({
        title: "Email obrigatório",
        description: "Por favor, insira o email do usuário",
        variant: "destructive",
      });
      return;
    }

    try {
      // Buscar usuário pelo email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", targetEmail)
        .single();

      if (profileError || !profile) {
        toast({
          title: "Usuário não encontrado",
          description: "Não encontramos um usuário com este email",
          variant: "destructive",
        });
        return;
      }

      // Inserir role (upsert para não duplicar)
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: profile.id, role: selectedRole },
          { onConflict: "user_id,role" }
        );

      if (roleError) throw roleError;

      toast({
        title: "Sucesso!",
        description: `Role ${selectedRole} atribuída para ${targetEmail}`,
      });

      setTargetEmail("");
      fetchAllUsers();
    } catch (error: any) {
      console.error("Error assigning role:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atribuir a role",
        variant: "destructive",
      });
    }
  };

  const removeRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Role ${role} removida`,
      });

      fetchAllUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível remover a role",
        variant: "destructive",
      });
    }
  };

  if (loading) {
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
            onClick={() => navigate("/library")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Painel Administrativo</h1>
              <p className="text-sm text-muted-foreground">
                Gerenciar usuários e permissões
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <Tabs defaultValue="assign" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="assign">Atribuir Roles</TabsTrigger>
            <TabsTrigger value="users">Gerenciar Usuários</TabsTrigger>
          </TabsList>

          {/* Tab: Assign Roles */}
          <TabsContent value="assign">
            <Card className="glass p-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Crown className="w-6 h-6 text-primary" />
                Atribuir Role para Usuário
              </h2>
              
              <div className="space-y-6">
                <div>
                  <Label htmlFor="email">Email do Usuário</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="role">Selecionar Role</Label>
                  <Select 
                    value={selectedRole} 
                    onValueChange={(value: string) => {
                      if (value === "admin" || value === "premium" || value === "free") {
                        setSelectedRole(value);
                      }
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-red-500" />
                          Admin (Acesso Total)
                        </div>
                      </SelectItem>
                      <SelectItem value="premium">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          Premium (Recursos Premium)
                        </div>
                      </SelectItem>
                      <SelectItem value="free">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-500" />
                          Free (Padrão)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={assignRole}
                  className="w-full bg-gradient-to-r from-primary to-accent"
                  size="lg"
                >
                  Atribuir Role
                </Button>

                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">ℹ️ Informações sobre Roles:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• <strong>Admin:</strong> Acesso completo ao sistema e painel admin</li>
                    <li>• <strong>Premium:</strong> Acesso a recursos premium (limite de 1000 livros)</li>
                    <li>• <strong>Free:</strong> Conta gratuita (limite de 5 livros)</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Tab: Manage Users */}
          <TabsContent value="users">
            <Card className="glass p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <Users className="w-6 h-6 text-primary" />
                  Todos os Usuários ({allUsers.length})
                </h2>
                <Button variant="outline" onClick={fetchAllUsers} disabled={loadingUsers}>
                  {loadingUsers ? "Carregando..." : "Atualizar"}
                </Button>
              </div>

              <div className="space-y-4">
                {allUsers.map((user) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border border-border/50 rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{user.full_name || "Sem nome"}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.roles.length > 0 ? (
                          user.roles.map((role: string) => (
                            <div
                              key={role}
                              className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20"
                            >
                              {role === "admin" && <Shield className="w-4 h-4 text-red-500" />}
                              {role === "premium" && <Star className="w-4 h-4 text-yellow-500" />}
                              {role === "free" && <Users className="w-4 h-4 text-gray-500" />}
                              <span className="text-sm font-medium capitalize">{role}</span>
                              <button
                                onClick={() => removeRole(user.id, role)}
                                className="ml-2 text-destructive hover:text-destructive/80"
                              >
                                ×
                              </button>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Sem roles</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPanel;
