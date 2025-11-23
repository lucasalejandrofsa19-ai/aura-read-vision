import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Camera, Save, Crown, CreditCard, Shield, Volume2 } from "lucide-react";
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
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import { useUserRole } from "@/hooks/useUserRole";
import { useSoundEffects } from "@/hooks/useSoundEffects";

const Profile = () => {
  const navigate = useNavigate();
  const { user, subscriptionTier } = useAuth();
  const { theme } = useTheme();
  const { isAdmin, hasPremiumAccess } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const { soundSettings, updateSoundSetting } = useSoundEffects();

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
      setAvatarUrl(data?.avatar_url || "");
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

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
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
              <h1 className="text-3xl font-bold">Configurações do Perfil</h1>
              {isAdmin && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30">
                  <Shield className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-red-500">Admin</span>
                </div>
              )}
              {hasPremiumAccess && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                  <Crown className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-semibold text-purple-500">Premium</span>
                </div>
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
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                          <Crown className="w-3.5 h-3.5 text-purple-500" />
                          <span className="text-xs font-semibold text-purple-500">Premium</span>
                        </div>
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

            {/* Sound Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Preferências de Som
                </CardTitle>
                <CardDescription>
                  Configure efeitos sonoros durante a leitura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="page-turn-sound">Som de virada de página</Label>
                    <p className="text-sm text-muted-foreground">
                      Reproduz um som ao mudar de página
                    </p>
                  </div>
                  <Switch
                    id="page-turn-sound"
                    checked={soundSettings.pageTurnSoundEnabled}
                    onCheckedChange={async (checked) => {
                      try {
                        await updateSoundSetting('pageTurnSoundEnabled', checked);
                        toast.success(checked ? "Som ativado" : "Som desativado");
                      } catch (error) {
                        toast.error("Erro ao atualizar configuração");
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="highlight-sound">Som ao destacar texto</Label>
                    <p className="text-sm text-muted-foreground">
                      Reproduz um som ao adicionar um destaque
                    </p>
                  </div>
                  <Switch
                    id="highlight-sound"
                    checked={soundSettings.highlightSoundEnabled}
                    onCheckedChange={async (checked) => {
                      try {
                        await updateSoundSetting('highlightSoundEnabled', checked);
                        toast.success(checked ? "Som ativado" : "Som desativado");
                      } catch (error) {
                        toast.error("Erro ao atualizar configuração");
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="note-sound">Som ao adicionar nota</Label>
                    <p className="text-sm text-muted-foreground">
                      Reproduz um som ao criar uma nova nota
                    </p>
                  </div>
                  <Switch
                    id="note-sound"
                    checked={soundSettings.noteSoundEnabled}
                    onCheckedChange={async (checked) => {
                      try {
                        await updateSoundSetting('noteSoundEnabled', checked);
                        toast.success(checked ? "Som ativado" : "Som desativado");
                      } catch (error) {
                        toast.error("Erro ao atualizar configuração");
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="bookmark-sound">Som ao marcar página</Label>
                    <p className="text-sm text-muted-foreground">
                      Reproduz um som ao adicionar um marcador
                    </p>
                  </div>
                  <Switch
                    id="bookmark-sound"
                    checked={soundSettings.bookmarkSoundEnabled}
                    onCheckedChange={async (checked) => {
                      try {
                        await updateSoundSetting('bookmarkSoundEnabled', checked);
                        toast.success(checked ? "Som ativado" : "Som desativado");
                      } catch (error) {
                        toast.error("Erro ao atualizar configuração");
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="delete-sound">Som ao deletar</Label>
                    <p className="text-sm text-muted-foreground">
                      Reproduz um som ao excluir destaques ou notas
                    </p>
                  </div>
                  <Switch
                    id="delete-sound"
                    checked={soundSettings.deleteSoundEnabled}
                    onCheckedChange={async (checked) => {
                      try {
                        await updateSoundSetting('deleteSoundEnabled', checked);
                        toast.success(checked ? "Som ativado" : "Som desativado");
                      } catch (error) {
                        toast.error("Erro ao atualizar configuração");
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <ReadingStatsCard />
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
                    <div className={`p-3 rounded-full ${
                      subscriptionTier === "premium" ? "bg-gradient-to-br from-purple-500 to-purple-700" :
                      subscriptionTier === "pro" ? "bg-gradient-to-br from-blue-500 to-blue-700" :
                      "bg-gradient-to-br from-slate-500 to-slate-700"
                    }`}>
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        Plano {subscriptionTier === "free" ? "Gratuito" : subscriptionTier === "pro" ? "Pro" : "Premium"}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {subscriptionTier === "premium" && "Acesso completo a todos os recursos premium"}
                        {subscriptionTier === "pro" && "Recursos avançados de leitura"}
                        {subscriptionTier === "free" && "Recursos básicos de leitura"}
                      </p>
                      <div className="flex flex-col gap-1 text-sm">
                        {subscriptionTier === "free" && (
                          <>
                            <span className="text-muted-foreground">• Até 5 PDFs</span>
                            <span className="text-muted-foreground">• Destaques básicos</span>
                          </>
                        )}
                        {subscriptionTier === "pro" && (
                          <>
                            <span className="text-muted-foreground">• Até 100 PDFs</span>
                            <span className="text-muted-foreground">• Exportação de anotações</span>
                            <span className="text-muted-foreground">• Modo de apresentação</span>
                          </>
                        )}
                        {subscriptionTier === "premium" && (
                          <>
                            <span className="text-muted-foreground">• PDFs ilimitados</span>
                            <span className="text-muted-foreground">• Leitura em voz alta</span>
                            <span className="text-muted-foreground">• Modo de leitura focada</span>
                            <span className="text-muted-foreground">• Suporte prioritário</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {subscriptionTier === "free" && (
                    <Button
                      onClick={() => navigate("/pricing")}
                      className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Ver Planos Premium
                    </Button>
                  )}
                  {(subscriptionTier === "pro" || subscriptionTier === "premium") && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => navigate("/pricing")}
                        className="flex-1"
                      >
                        Ver Outros Planos
                      </Button>
                    </>
                  )}
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
                <ProfileHighlights />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;