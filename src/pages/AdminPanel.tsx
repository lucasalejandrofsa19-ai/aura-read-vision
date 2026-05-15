import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo } from "react";
import { Shield, Users, ArrowLeft, Star, TrendingUp, Search, UserPlus, Filter, X, MessageSquare, Ban } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PremiumBadge } from "@/components/PremiumBadge";
import { SEO } from "@/components/SEO";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { isAdmin, loading } = useUserRole();
  const { toast } = useToast();
  
  const [targetEmail, setTargetEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "premium" | "free">("premium");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "premium" | "free">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(20);

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

  const removeRole = async (userId: string, role: "admin" | "premium" | "free") => {
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

  // Filtered and searched users
  const filteredUsers = useMemo(() => {
    let filtered = allUsers;

    // Search by email or name
    if (searchQuery) {
      filtered = filtered.filter(user => 
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.roles.includes(roleFilter));
    }

    return filtered;
  }, [allUsers, searchQuery, roleFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, usersPerPage]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Statistics
  const stats = useMemo(() => {
    const totalUsers = allUsers.length;
    const adminCount = allUsers.filter(u => u.roles.includes("admin")).length;
    const premiumCount = allUsers.filter(u => u.roles.includes("premium")).length;
    const freeCount = allUsers.filter(u => u.roles.includes("free")).length;
    const noRoleCount = allUsers.filter(u => u.roles.length === 0).length;

    return { totalUsers, adminCount, premiumCount, freeCount, noRoleCount };
  }, [allUsers]);

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
      <SEO title="Painel admin — AURA READ" description="Painel de administração interno da AURA READ para gerenciamento de usuários, papéis e configurações." path="/admin" noindex />
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
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/admin/feedback")}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Sugestões
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/audit-logs")}
            >
              <Shield className="w-4 h-4 mr-2" />
              Auditoria
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/blocked-ips")}
            >
              <Ban className="w-4 h-4 mr-2" />
              IPs Bloqueados
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/analytics")}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Analytics
            </Button>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total de Usuários</CardDescription>
              <CardTitle className="text-3xl">{stats.totalUsers}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-4 h-4" />
                Todos os registros
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Administradores</CardDescription>
              <CardTitle className="text-3xl text-red-500">{stats.adminCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-4 h-4" />
                Acesso total
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Usuários Premium</CardDescription>
              <CardTitle className="text-3xl text-yellow-500">{stats.premiumCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Star className="w-4 h-4" />
                Recursos premium
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Usuários Free</CardDescription>
              <CardTitle className="text-3xl text-blue-500">{stats.freeCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-4 h-4" />
                Plano gratuito
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Sem Roles</CardDescription>
              <CardTitle className="text-3xl text-gray-500">{stats.noRoleCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserPlus className="w-4 h-4" />
                Atribuir role
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="users">Gerenciar Usuários</TabsTrigger>
            <TabsTrigger value="assign">Atribuir Roles</TabsTrigger>
          </TabsList>

          {/* Tab: Assign Roles */}
          <TabsContent value="assign">
            <Card className="glass p-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <PremiumBadge variant="icon-only" className="w-6 h-6" />
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
            <Card className="glass">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <Users className="w-6 h-6 text-primary" />
                      Gerenciar Usuários
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Mostrando {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} de {filteredUsers.length} usuário(s)
                      {allUsers.length !== filteredUsers.length && ` (${allUsers.length} total)`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="perPage" className="text-sm whitespace-nowrap">Por página:</Label>
                      <Select value={usersPerPage.toString()} onValueChange={(value) => setUsersPerPage(Number(value))}>
                        <SelectTrigger id="perPage" className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" onClick={fetchAllUsers} disabled={loadingUsers}>
                      {loadingUsers ? "Carregando..." : "Atualizar"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Search and Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por email ou nome..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
                    <SelectTrigger className="w-full md:w-[200px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Roles</SelectItem>
                      <SelectItem value="admin">Apenas Admins</SelectItem>
                      <SelectItem value="premium">Apenas Premium</SelectItem>
                      <SelectItem value="free">Apenas Free</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Users List */}
                <div className="space-y-3">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">
                        {searchQuery || roleFilter !== "all" 
                          ? "Nenhum usuário encontrado com os filtros aplicados" 
                          : "Nenhum usuário cadastrado"}
                      </p>
                    </div>
                  ) : (
                    <>
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-3 pr-4">
                          {paginatedUsers.map((user) => (
                            <motion.div
                              key={user.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-4 border border-border/50 rounded-lg hover:border-primary/50 transition-all hover:shadow-md"
                            >
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold">{user.full_name || "Sem nome"}</p>
                                    {user.id === currentUser?.id && (
                                      <Badge variant="outline" className="text-xs">Você</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{user.email}</p>
                                </div>
                                
                                <div className="flex items-center gap-2 flex-wrap">
                                  {user.roles.length > 0 ? (
                                    user.roles.map((role: "admin" | "premium" | "free") => (
                                      <Badge
                                        key={role}
                                        variant="secondary"
                                        className="flex items-center gap-2 px-3 py-1"
                                      >
                                        {role === "admin" && <Shield className="w-3 h-3 text-red-500" />}
                                        {role === "premium" && <Star className="w-3 h-3 text-yellow-500" />}
                                        {role === "free" && <Users className="w-3 h-3 text-gray-500" />}
                                        <span className="capitalize">{role}</span>
                                        <button
                                          onClick={() => removeRole(user.id, role)}
                                          className="ml-1 hover:text-destructive transition-colors"
                                          title="Remover role"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                      Sem roles
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="text-sm text-muted-foreground">
                            Página {currentPage} de {totalPages}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToPage(1)}
                              disabled={currentPage === 1}
                            >
                              Primeira
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToPage(currentPage - 1)}
                              disabled={currentPage === 1}
                            >
                              Anterior
                            </Button>
                            
                            {/* Page numbers */}
                            <div className="flex gap-1">
                              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                  pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                  pageNum = totalPages - 4 + i;
                                } else {
                                  pageNum = currentPage - 2 + i;
                                }
                                
                                return (
                                  <Button
                                    key={pageNum}
                                    variant={currentPage === pageNum ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => goToPage(pageNum)}
                                    className="w-10"
                                  >
                                    {pageNum}
                                  </Button>
                                );
                              })}
                            </div>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToPage(currentPage + 1)}
                              disabled={currentPage === totalPages}
                            >
                              Próxima
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToPage(totalPages)}
                              disabled={currentPage === totalPages}
                            >
                              Última
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPanel;
