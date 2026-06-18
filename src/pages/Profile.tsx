import { SEO } from "@/components/SEO";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { getSignedStorageUrl } from "@/lib/storageUrl";
import { ArrowLeft, Camera, Save, CreditCard, Shield, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ThemeSelector } from "@/components/ThemeSelector";
import { ProfileHighlights } from "@/components/ProfileHighlights";
import { ReadingStatsCard } from "@/components/ReadingStatsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import { useUserRole } from "@/hooks/useUserRole";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { LazyLoadWrapper } from "@/components/LazyLoadWrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumBadge } from "@/components/PremiumBadge";



const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isAdmin, hasPremiumAccess } = useUserRole();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const { isUltraPerformanceMode, togglePerformanceMode, loading: perfLoading } = usePerformanceMode();
  const [transitionsEnabled, setTransitionsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("auraread:transitions-disabled") !== "1";
  });

  const toggleTransitions = (enabled: boolean) => {
    setTransitionsEnabled(enabled);
    if (enabled) {
      localStorage.removeItem("auraread:transitions-disabled");
      toast.success("Transições suaves ativadas");
    } else {
      localStorage.setItem("auraread:transitions-disabled", "1");
      toast.success("Transições suaves desativadas");
    }
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setFullName(data?.full_name || "");
      const signed = await getSignedStorageUrl("avatars", data?.avatar_url);
      setAvatarUrl(signed);
    } catch (error) {
      captureError(error, { context: "load_profile" });
    }
  };

  const updateProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      captureError(error, { context: "update_profile" });
      toast.error("Erro ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Math.random()}.${fileExt}`;

    setUploading(true);
    try {
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Persist the bare path; sign on read
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: filePath })
        .eq("id", user.id);

      if (updateError) throw updateError;

      const signed = await getSignedStorageUrl("avatars", filePath);
      setAvatarUrl(signed);
      toast.success("Avatar atualizado com sucesso!");
    } catch (error) {
      captureError(error, { context: "upload_avatar" });
      toast.error("Erro ao fazer upload do avatar");
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (email: string, name?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email
      .split("@")[0]
      .split(".")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
    <SEO
      title="Meu Perfil — AURA READ"
      description="Gerencie sua conta, preferências de leitura e plano de assinatura."
      path="/profile"
      noindex
    />
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-screen-2xl mx-auto px-4 lg:px-10 xl:px-16 py-8 lg:py-12">
        {/* Header */}
        <motion.div
          initial={isMobile ? false : { opacity: 0, y: -20 }}
          animate={isMobile ? false : { opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <motion.h1 
                initial={isMobile ? false : { opacity: 0, x: -20 }}
                animate={isMobile ? false : { opacity: 1, x: 0 }}
                transition={isMobile ? undefined : { duration: 0.5 }}
                className="text-3xl font-bold"
              >
                Configurações do Perfil
              </motion.h1>
              {isAdmin && (
                <motion.div 
                  initial={isMobile ? false : { opacity: 0, scale: 0.8, y: -10 }}
                  animate={isMobile ? false : { opacity: 1, scale: 1, y: 0 }}
                  transition={isMobile ? undefined : { 
                    duration: 0.5, 
                    delay: 0.2,
                    type: "spring",
                    stiffness: 200,
                    damping: 15
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30"
                >
                  <Shield className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-red-500">Admin</span>
                </motion.div>
              )}
              {hasPremiumAccess && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div 
                        initial={isMobile ? false : { opacity: 0, scale: 0.8, y: -10 }}
                        animate={isMobile ? false : { opacity: 1, scale: 1, y: 0 }}
                        transition={isMobile ? undefined : { 
                          duration: 0.5, 
                          delay: isAdmin ? 0.35 : 0.2,
                          type: "spring",
                          stiffness: 200,
                          damping: 15
                        }}
                         className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 ${!isMobile ? 'overflow-hidden' : ''} cursor-help`}
                       >
                         <PremiumBadge variant="compact" className="relative z-10" />
                         {!isMobile && (
                           <div className="absolute inset-0 -left-full w-[150%] h-full bg-gradient-to-r from-transparent via-white/70 to-transparent animate-card-swipe will-change-transform" />
                         )}
                       </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-semibold text-sm flex items-center gap-1">
                          <PremiumBadge variant="icon-only" />
                          Benefícios Premium
                        </p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          <li>✓ Upload ilimitado de livros</li>
                          <li>✓ Acesso a livros premium exclusivos</li>
                          <li>✓ Geração de imagens para destaques</li>
                          <li>✓ Estatísticas avançadas de leitura</li>
                          <li>✓ Suporte prioritário</li>
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin")}
                className="mt-2"
              >
                <Shield className="w-4 h-4 mr-2" />
                Painel Admin
              </Button>
            )}
          </div>
        </motion.div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
            <TabsTrigger value="subscription">Assinatura</TabsTrigger>
            <TabsTrigger value="highlights">Destaques</TabsTrigger>
          </TabsList>


          <TabsContent value="profile" className="space-y-6">
            {/* Profile Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Informações do Perfil</CardTitle>
                <CardDescription>
                  Atualize suas informações pessoais e avatar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-2xl">
                        {user?.email ? getInitials(user.email, fullName) : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="avatar-upload"
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Camera className="h-6 w-6 text-white" />
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={uploadAvatar}
                      disabled={uploading}
                      aria-label="Enviar foto de perfil"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {isAdmin && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30">
                          <Shield className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-xs font-semibold text-red-500">Admin</span>
                        </div>
                      )}
                      {hasPremiumAccess && (
                        <PremiumBadge variant="default" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Clique no avatar para alterar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG ou GIF. Máximo 2MB.
                    </p>
                  </div>
                </div>

                {/* Name Input */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                {/* Email (read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    O email não pode ser alterado
                  </p>
                </div>

                {/* Save Button */}
                <Button onClick={updateProfile} disabled={loading} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </CardContent>
            </Card>

            {/* Theme Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Tema</CardTitle>
                <CardDescription>
                  Escolha o tema que melhor se adapta à sua leitura
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Tema Atual: <span className="font-semibold capitalize">{theme}</span></Label>
                  <ThemeSelector />
                </div>
              </CardContent>
            </Card>

            {/* Ultra Performance Mode Card */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Modo Ultra Performance
                </CardTitle>
                <CardDescription>
                  Desabilita todas as animações e efeitos visuais para máxima performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="ultra-performance">Ativar Modo Ultra Performance</Label>
                    <p className="text-sm text-muted-foreground">
                      Remove animações, transições e efeitos visuais complexos. 
                      Recomendado para dispositivos mais antigos ou com desempenho limitado.
                    </p>
                  </div>
                  <Switch
                    id="ultra-performance"
                    checked={isUltraPerformanceMode}
                    onCheckedChange={togglePerformanceMode}
                    disabled={perfLoading}
                  />
                </div>
                
                {isUltraPerformanceMode && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm font-medium text-primary flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Modo Ultra Performance Ativo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Todas as animações e efeitos visuais estão desabilitados para melhor desempenho
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <LazyLoadWrapper
              minHeight="300px"
              fallback={
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              }
            >
              <ReadingStatsCard />
            </LazyLoadWrapper>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Plano e Assinatura
                </CardTitle>
                <CardDescription>
                  Gerencie sua assinatura e veja os benefícios do seu plano
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Plan */}
                <div className="flex items-start justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-gradient-to-br from-amber-500 to-orange-500">
                      <PremiumBadge variant="icon-only" className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        Plano Gratuito
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Recursos básicos de leitura
                      </p>
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="text-muted-foreground">• Até 5 PDFs</span>
                        <span className="text-muted-foreground">• Destaques básicos</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="premium"
                    onClick={() => navigate("/pricing")}
                    className="flex-1 gap-2"
                  >
                    <PremiumBadge variant="icon-only" />
                    Ver Planos Premium
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="highlights">
            <Card>
              <CardHeader>
                <CardTitle>Seus Destaques</CardTitle>
                <CardDescription>
                  Visualize todos os destaques que você fez em seus livros e exporte-os como PDF
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LazyLoadWrapper
                  minHeight="400px"
                  fallback={
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  }
                >
                  <ProfileHighlights />
                </LazyLoadWrapper>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

      </div>
    </div>
    </>
  );
};

export default Profile;