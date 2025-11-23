import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Shield, Activity, Calendar, User, Target, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuditLogs, type AuditLog } from "@/hooks/useAuditLogs";
import { useUserData } from "@/hooks/useUserData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminAuditLogs() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: userLoading } = useUserData();
  
  const [selectedFeature, setSelectedFeature] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [searchUserId, setSearchUserId] = useState("");
  const [sendingAlert, setSendingAlert] = useState(false);

  const { logs, loading, stats, suspiciousActivity, refetch } = useAuditLogs({
    limit: 100,
    feature: selectedFeature || undefined,
    startDate,
    endDate,
  });

  const handleSendSecurityAlert = async (type: 'high_volume_ip' | 'rate_limit_violation') => {
    setSendingAlert(true);
    try {
      let alertData;
      
      if (type === 'high_volume_ip' && suspiciousActivity.suspiciousIPs.length > 0) {
        const topIP = suspiciousActivity.suspiciousIPs[0];
        alertData = {
          type: 'high_volume_ip',
          ipAddress: topIP.ip,
          details: {
            attempts: topIP.count,
            threshold: 20,
            allSuspiciousIPs: suspiciousActivity.suspiciousIPs,
          },
        };
      } else if (type === 'rate_limit_violation') {
        alertData = {
          type: 'rate_limit_violation',
          details: {
            totalViolations: suspiciousActivity.rateLimitViolations,
            threshold: 5,
            recentViolations: logs
              .filter(log => log.reason === 'rate_limit_exceeded')
              .slice(0, 5)
              .map(log => ({
                userId: log.user_id,
                ipAddress: log.ip_address,
                timestamp: log.created_at,
              })),
          },
        };
      }

      const { error } = await supabase.functions.invoke('send-security-alert', {
        body: { alert: alertData },
      });

      if (error) throw error;

      toast.success('Alerta enviado com sucesso!');
    } catch (error) {
      console.error('Error sending alert:', error);
      toast.error('Erro ao enviar alerta');
    } finally {
      setSendingAlert(false);
    }
  };

  // Filter by user ID if searching
  const filteredLogs = searchUserId
    ? logs.filter(log => log.user_id.toLowerCase().includes(searchUserId.toLowerCase()))
    : logs;

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-destructive" />
              Acesso Negado
            </CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  };

  const getActionBadge = (granted: boolean) => {
    return granted ? (
      <Badge variant="default" className="bg-green-500">Permitido</Badge>
    ) : (
      <Badge variant="destructive">Negado</Badge>
    );
  };

  const getFeatureName = (feature: string) => {
    const featureNames: Record<string, string> = {
      'premium_access_check': 'Verificação Premium',
      'premium_access_frontend': 'Acesso Frontend',
      'text_to_speech': 'Leitura em Voz Alta',
      'export_word': 'Exportar Word',
      'export_notion': 'Exportar Notion',
      'export_pdf': 'Exportar PDF',
      'export_markdown': 'Exportar Markdown',
    };
    return featureNames[feature] || feature;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6" />
                Logs de Auditoria Premium
              </h1>
              <p className="text-sm text-muted-foreground">
                Monitore tentativas de acesso a recursos premium
              </p>
            </div>
            <Button onClick={refetch} variant="outline">
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="logs">Logs Detalhados</TabsTrigger>
            <TabsTrigger value="suspicious">Atividade Suspeita</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Tentativas
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalAttempts}</div>
                  <p className="text-xs text-muted-foreground">
                    Últimas {logs.length} entradas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Acessos Permitidos
                  </CardTitle>
                  <Shield className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">{stats.granted}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.grantRate.toFixed(1)}% de sucesso
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Acessos Negados
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{stats.denied}</div>
                  <p className="text-xs text-muted-foreground">
                    Tentativas não autorizadas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Rate Limits
                  </CardTitle>
                  <Target className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">
                    {suspiciousActivity.rateLimitViolations}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Limites excedidos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Features Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Acessos por Feature</CardTitle>
                <CardDescription>
                  Distribuição de tentativas de acesso por recurso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(stats.byFeature).map(([feature, count]) => (
                    <div key={feature} className="flex items-center">
                      <div className="w-40 text-sm font-medium">{getFeatureName(feature)}</div>
                      <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{ width: `${(count / stats.totalAttempts) * 100}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-sm text-muted-foreground">
                        {count} ({((count / stats.totalAttempts) * 100).toFixed(0)}%)
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filtros</CardTitle>
                <CardDescription>
                  Refine a busca por período, usuário ou recurso
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Início</Label>
                  <Input
                    id="startDate"
                    type="date"
                    onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">Data Fim</Label>
                  <Input
                    id="endDate"
                    type="date"
                    onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feature">Feature</Label>
                  <Select value={selectedFeature} onValueChange={setSelectedFeature}>
                    <SelectTrigger id="feature">
                      <SelectValue placeholder="Todas as features" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      {Object.keys(stats.byFeature).map(feature => (
                        <SelectItem key={feature} value={feature}>
                          {getFeatureName(feature)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    placeholder="Buscar por ID..."
                    value={searchUserId}
                    onChange={(e) => setSearchUserId(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle>Registros de Auditoria</CardTitle>
                <CardDescription>
                  {filteredLogs.length} registro(s) encontrado(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Feature</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">
                              {formatDate(log.created_at)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.user_id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getFeatureName(log.feature)}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{log.action}</TableCell>
                            <TableCell>{getActionBadge(log.granted)}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.ip_address || 'N/A'}
                            </TableCell>
                            <TableCell className="text-xs max-w-xs truncate">
                              {log.reason}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suspicious Activity Tab */}
          <TabsContent value="suspicious" className="space-y-6">
            {suspiciousActivity.hasSuspiciousActivity ? (
              <>
                <Card className="border-destructive">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-5 h-5" />
                      Atividade Suspeita Detectada
                    </CardTitle>
                    <CardDescription>
                      Foram identificados padrões anormais de acesso
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {suspiciousActivity.suspiciousIPs.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">IPs com Alto Volume de Tentativas</h3>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleSendSecurityAlert('high_volume_ip')}
                            disabled={sendingAlert}
                          >
                            <Bell className="w-4 h-4 mr-2" />
                            Enviar Alerta
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {suspiciousActivity.suspiciousIPs.map(({ ip, count }) => (
                            <div key={ip} className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                              <span className="font-mono text-sm">{ip}</span>
                              <Badge variant="destructive">{count} tentativas</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {suspiciousActivity.rateLimitViolations > 5 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">Violações de Rate Limit</h3>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                            onClick={() => handleSendSecurityAlert('rate_limit_violation')}
                            disabled={sendingAlert}
                          >
                            <Bell className="w-4 h-4 mr-2" />
                            Enviar Alerta
                          </Button>
                        </div>
                        <div className="p-3 bg-orange-500/10 rounded-lg">
                          <p className="text-sm">
                            <span className="font-semibold text-orange-500">
                              {suspiciousActivity.rateLimitViolations}
                            </span>{" "}
                            tentativas bloqueadas por excesso de requisições
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent suspicious logs */}
                <Card>
                  <CardHeader>
                    <CardTitle>Logs Suspeitos Recentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>IP</TableHead>
                            <TableHead>Feature</TableHead>
                            <TableHead>Motivo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs
                            .filter(log => !log.granted || log.reason === 'rate_limit_exceeded')
                            .slice(0, 20)
                            .map((log) => (
                              <TableRow key={log.id}>
                                <TableCell className="text-xs">
                                  {formatDate(log.created_at)}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {log.ip_address}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{getFeatureName(log.feature)}</Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {log.reason}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-500">
                    <Shield className="w-5 h-5" />
                    Nenhuma Atividade Suspeita
                  </CardTitle>
                  <CardDescription>
                    Todos os padrões de acesso estão dentro do esperado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Não foram detectados padrões anormais de acesso aos recursos premium.
                    Continue monitorando regularmente para garantir a segurança do sistema.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
