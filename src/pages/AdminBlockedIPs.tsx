import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Ban, Unlock, Plus, CheckCircle, Download, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SEO } from "@/components/SEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBlockedIPs } from "@/hooks/useBlockedIPs";
import { useWhitelistedIPs } from "@/hooks/useWhitelistedIPs";
import { useUserData } from "@/hooks/useUserData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function AdminBlockedIPs() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: userLoading } = useUserData();
  const { blockedIPs, loading, blockIP, unblockIP, stats, checkReputation } = useBlockedIPs();
  const { whitelistedIPs, loading: whitelistLoading, whitelistIP, removeFromWhitelist, stats: whitelistStats } = useWhitelistedIPs();
  
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [newBlockIP, setNewBlockIP] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [newBlockDuration, setNewBlockDuration] = useState<string>("24");

  const [whitelistDialogOpen, setWhitelistDialogOpen] = useState(false);
  const [newWhitelistIP, setNewWhitelistIP] = useState("");
  const [newWhitelistDescription, setNewWhitelistDescription] = useState("");
  const [newWhitelistExpiration, setNewWhitelistExpiration] = useState<string>("permanent");

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importType, setImportType] = useState<"blocked" | "whitelist">("blocked");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [checkingReputation, setCheckingReputation] = useState<string | null>(null);

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
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const isActive = (blockedUntil: string | null) => {
    if (!blockedUntil) return true;
    return new Date(blockedUntil) > new Date();
  };

  const handleBlockIP = async () => {
    if (!newBlockIP || !newBlockReason) return;
    
    const duration = newBlockDuration === "permanent" ? undefined : parseInt(newBlockDuration);
    const success = await blockIP(newBlockIP, newBlockReason, duration);
    
    if (success) {
      setBlockDialogOpen(false);
      setNewBlockIP("");
      setNewBlockReason("");
      setNewBlockDuration("24");
    }
  };

  const handleWhitelistIP = async () => {
    if (!newWhitelistIP || !newWhitelistDescription) return;
    
    const expiresInDays = newWhitelistExpiration === "permanent" ? undefined : parseInt(newWhitelistExpiration);
    const success = await whitelistIP(newWhitelistIP, newWhitelistDescription, expiresInDays);
    
    if (success) {
      setWhitelistDialogOpen(false);
      setNewWhitelistIP("");
      setNewWhitelistDescription("");
      setNewWhitelistExpiration("permanent");
    }
  };

  // CSV Export Functions
  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleExportBlocked = () => {
    const headers = ['ip_address', 'reason', 'blocked_at', 'blocked_until', 'auto_blocked'];
    const data = blockedIPs.map(ip => ({
      ip_address: ip.ip_address,
      reason: ip.reason,
      blocked_at: ip.blocked_at,
      blocked_until: ip.blocked_until || 'permanent',
      auto_blocked: ip.auto_blocked ? 'true' : 'false',
    }));
    
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    exportToCSV(data, `blocked-ips-${timestamp}.csv`, headers);
    toast.success('IPs bloqueados exportados com sucesso');
  };

  const handleExportWhitelist = () => {
    const headers = ['ip_address', 'description', 'added_at', 'expires_at'];
    const data = whitelistedIPs.map(ip => ({
      ip_address: ip.ip_address,
      description: ip.description,
      added_at: ip.added_at,
      expires_at: ip.expires_at || 'permanent',
    }));
    
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    exportToCSV(data, `whitelisted-ips-${timestamp}.csv`, headers);
    toast.success('IPs da whitelist exportados com sucesso');
  };

  // CSV Import Functions
  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      values.push(current.trim());
      return values;
    });
  };

  const validateIPAddress = (ip: string): boolean => {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;
    
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  };

  const handleImportCSV = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    setImporting(true);

    try {
      const text = await importFile.text();
      const rows = parseCSV(text);
      
      if (rows.length < 2) {
        toast.error('Arquivo CSV vazio ou inválido');
        setImporting(false);
        return;
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const dataRows = rows.slice(1);

      let successCount = 0;
      let errorCount = 0;

      if (importType === 'blocked') {
        const ipIndex = headers.indexOf('ip_address');
        const reasonIndex = headers.indexOf('reason');
        const durationIndex = headers.indexOf('blocked_until');

        if (ipIndex === -1 || reasonIndex === -1) {
          toast.error('CSV deve conter colunas: ip_address, reason');
          setImporting(false);
          return;
        }

        for (const row of dataRows) {
          const ip = row[ipIndex]?.trim();
          const reason = row[reasonIndex]?.trim();
          const blockedUntil = row[durationIndex]?.trim();

          if (!ip || !reason || !validateIPAddress(ip)) {
            errorCount++;
            continue;
          }

          let durationHours: number | undefined;
          if (blockedUntil && blockedUntil !== 'permanent') {
            const blockedDate = new Date(blockedUntil);
            if (!isNaN(blockedDate.getTime())) {
              durationHours = Math.ceil((blockedDate.getTime() - Date.now()) / (1000 * 60 * 60));
            }
          }

          const success = await blockIP(ip, reason, durationHours);
          if (success) successCount++;
          else errorCount++;
        }
      } else {
        const ipIndex = headers.indexOf('ip_address');
        const descIndex = headers.indexOf('description');
        const expiresIndex = headers.indexOf('expires_at');

        if (ipIndex === -1 || descIndex === -1) {
          toast.error('CSV deve conter colunas: ip_address, description');
          setImporting(false);
          return;
        }

        for (const row of dataRows) {
          const ip = row[ipIndex]?.trim();
          const description = row[descIndex]?.trim();
          const expiresAt = row[expiresIndex]?.trim();

          if (!ip || !description || !validateIPAddress(ip)) {
            errorCount++;
            continue;
          }

          let expiresInDays: number | undefined;
          if (expiresAt && expiresAt !== 'permanent') {
            const expiresDate = new Date(expiresAt);
            if (!isNaN(expiresDate.getTime())) {
              expiresInDays = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            }
          }

          const success = await whitelistIP(ip, description, expiresInDays);
          if (success) successCount++;
          else errorCount++;
        }
      }

      toast.success(`Importação concluída: ${successCount} sucesso(s), ${errorCount} erro(s)`);
      setImportDialogOpen(false);
      setImportFile(null);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao importar arquivo CSV');
    } finally {
      setImporting(false);
    }
  };

  const handleCheckReputation = async (ipAddress: string) => {
    setCheckingReputation(ipAddress);
    try {
      const reputation = await checkReputation(ipAddress);
      if (reputation) {
        toast.success(`Reputação verificada: ${reputation.abuseConfidenceScore}/100`);
      } else {
        toast.error('Não foi possível verificar a reputação');
      }
    } finally {
      setCheckingReputation(null);
    }
  };

  const handleBulkReputationCheck = async () => {
    const ipsToCheck = blockedIPs.filter(ip => 
      ip.reputation_score === null || ip.reputation_score === undefined
    );

    if (ipsToCheck.length === 0) {
      toast.info('Todos os IPs já foram verificados');
      return;
    }

    toast.info(`Verificando reputação de ${ipsToCheck.length} IP(s)...`);
    
    let checkedCount = 0;
    for (const ip of ipsToCheck) {
      await handleCheckReputation(ip.ip_address);
      checkedCount++;
      
      // Add small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    toast.success(`${checkedCount} IP(s) verificado(s)`);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="IPs bloqueados — AURA READ" description="Painel interno de gerenciamento de IPs bloqueados na AURA READ." path="/admin/blocked-ips" noindex />
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Gerenciamento de IPs</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie IPs bloqueados e whitelist de IPs confiáveis
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Importar CSV
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Importar IPs via CSV</DialogTitle>
                    <DialogDescription>
                      Carregue um arquivo CSV para adicionar múltiplos IPs de uma vez
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tipo de Importação</Label>
                      <Select value={importType} onValueChange={(value: "blocked" | "whitelist") => setImportType(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blocked">IPs Bloqueados</SelectItem>
                          <SelectItem value="whitelist">Whitelist</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="csvFile">Arquivo CSV</Label>
                      <Input
                        id="csvFile"
                        type="file"
                        accept=".csv"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      />
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <p className="text-sm font-medium">Formato do CSV:</p>
                      {importType === 'blocked' ? (
                        <code className="text-xs block bg-background p-2 rounded">
                          ip_address,reason,blocked_until<br/>
                          192.168.1.1,"Tentativas suspeitas",2025-12-31<br/>
                          10.0.0.5,"Spam",permanent
                        </code>
                      ) : (
                        <code className="text-xs block bg-background p-2 rounded">
                          ip_address,description,expires_at<br/>
                          192.168.1.100,"Servidor corporativo",2026-01-01<br/>
                          10.0.0.50,"VPN confiável",permanent
                        </code>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setImportDialogOpen(false);
                      setImportFile(null);
                    }}>
                      Cancelar
                    </Button>
                    <Button onClick={handleImportCSV} disabled={!importFile || importing}>
                      {importing ? 'Importando...' : 'Importar'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={whitelistDialogOpen} onOpenChange={setWhitelistDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Adicionar à Whitelist
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar IP à Whitelist</DialogTitle>
                    <DialogDescription>
                      IPs confiáveis que não serão bloqueados automaticamente
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="whitelistIP">Endereço IP</Label>
                      <Input
                        id="whitelistIP"
                        placeholder="192.168.1.1"
                        value={newWhitelistIP}
                        onChange={(e) => setNewWhitelistIP(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whitelistDesc">Descrição</Label>
                      <Input
                        id="whitelistDesc"
                        placeholder="Ex: Servidor corporativo"
                        value={newWhitelistDescription}
                        onChange={(e) => setNewWhitelistDescription(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whitelistExpiration">Expiração</Label>
                      <Select value={newWhitelistExpiration} onValueChange={setNewWhitelistExpiration}>
                        <SelectTrigger id="whitelistExpiration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 dias</SelectItem>
                          <SelectItem value="30">30 dias</SelectItem>
                          <SelectItem value="90">90 dias</SelectItem>
                          <SelectItem value="365">1 ano</SelectItem>
                          <SelectItem value="permanent">Permanente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setWhitelistDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleWhitelistIP} disabled={!newWhitelistIP || !newWhitelistDescription}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Ban className="w-4 h-4 mr-2" />
                    Bloquear IP
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bloquear Novo IP</DialogTitle>
                  <DialogDescription>
                    Adicione manualmente um IP à lista de bloqueio
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ipAddress">Endereço IP</Label>
                    <Input
                      id="ipAddress"
                      placeholder="192.168.1.1"
                      value={newBlockIP}
                      onChange={(e) => setNewBlockIP(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Motivo do Bloqueio</Label>
                    <Input
                      id="reason"
                      placeholder="Ex: Tentativas suspeitas de acesso"
                      value={newBlockReason}
                      onChange={(e) => setNewBlockReason(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duração</Label>
                    <Select value={newBlockDuration} onValueChange={setNewBlockDuration}>
                      <SelectTrigger id="duration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hora</SelectItem>
                        <SelectItem value="6">6 horas</SelectItem>
                        <SelectItem value="24">24 horas</SelectItem>
                        <SelectItem value="168">7 dias</SelectItem>
                        <SelectItem value="720">30 dias</SelectItem>
                        <SelectItem value="permanent">Permanente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleBlockIP} disabled={!newBlockIP || !newBlockReason}>
                    <Ban className="w-4 h-4 mr-2" />
                    Bloquear
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Tabs defaultValue="blocked" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="blocked">IPs Bloqueados</TabsTrigger>
            <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
          </TabsList>

          {/* Blocked IPs Tab */}
          <TabsContent value="blocked" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-7">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.active}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Expirados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{stats.expired}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Auto-Bloqueados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.autoBlocked}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Manuais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.manualBlocked}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Ameaças</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.threats}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Alto Risco</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.highRisk}</div>
            </CardContent>
              </Card>
            </div>

            {/* Blocked IPs Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>IPs Bloqueados</CardTitle>
                    <CardDescription>
                      {blockedIPs.length} IP(s) registrado(s)
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleBulkReputationCheck}
                      disabled={checkingReputation !== null}
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Verificar Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportBlocked}>
                      <Download className="w-4 h-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : blockedIPs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum IP bloqueado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endereço IP</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Reputação</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Bloqueado em</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockedIPs.map((ip) => (
                      <TableRow key={ip.id}>
                        <TableCell className="font-mono text-sm">
                          {ip.ip_address}
                        </TableCell>
                        <TableCell>
                          {isActive(ip.blocked_until) ? (
                            <Badge variant="destructive">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Expirado</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {ip.auto_blocked ? (
                            <Badge variant="outline" className="border-orange-500 text-orange-500">
                              Auto
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-blue-500 text-blue-500">
                              Manual
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {ip.reputation_score !== null && ip.reputation_score !== undefined ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${
                                  ip.reputation_score >= 75 ? 'text-red-500' :
                                  ip.reputation_score >= 50 ? 'text-orange-500' :
                                  ip.reputation_score >= 25 ? 'text-yellow-500' : 'text-green-500'
                                }`}>
                                  {ip.reputation_score}/100
                                </span>
                                {ip.is_threat && (
                                  <Badge variant="destructive" className="text-xs">Ameaça</Badge>
                                )}
                              </div>
                              {ip.threat_categories && ip.threat_categories.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {ip.threat_categories.slice(0, 2).map((cat: string) => (
                                    <Badge key={cat} variant="outline" className="text-xs">
                                      {cat}
                                    </Badge>
                                  ))}
                                  {ip.threat_categories.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{ip.threat_categories.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Não verificado</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {ip.reason}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(ip.blocked_at)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {ip.blocked_until ? formatDate(ip.blocked_until) : 'Permanente'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCheckReputation(ip.ip_address)}
                              disabled={checkingReputation === ip.ip_address}
                              title="Verificar reputação"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => unblockIP(ip.id)}
                              disabled={!isActive(ip.blocked_until)}
                              title="Desbloquear"
                            >
                              <Unlock className="w-4 h-4" />
                            </Button>
                          </div>
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

          {/* Whitelist Tab */}
          <TabsContent value="whitelist" className="space-y-6">
            {/* Whitelist Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{whitelistStats.total}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">{whitelistStats.active}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Expirados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-muted-foreground">{whitelistStats.expired}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Permanentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-500">{whitelistStats.permanent}</div>
                </CardContent>
              </Card>
            </div>

            {/* Whitelisted IPs Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>IPs na Whitelist</CardTitle>
                    <CardDescription>
                      {whitelistedIPs.length} IP(s) confiável(is)
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExportWhitelist}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {whitelistLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : whitelistedIPs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum IP na whitelist
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Endereço IP</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Adicionado em</TableHead>
                          <TableHead>Expira em</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {whitelistedIPs.map((ip) => (
                          <TableRow key={ip.id}>
                            <TableCell className="font-mono text-sm">
                              {ip.ip_address}
                            </TableCell>
                            <TableCell>
                              {isActive(ip.expires_at) ? (
                                <Badge variant="default" className="bg-green-500">Ativo</Badge>
                              ) : (
                                <Badge variant="secondary">Expirado</Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-sm">
                              {ip.description}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatDate(ip.added_at)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {ip.expires_at ? formatDate(ip.expires_at) : 'Permanente'}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeFromWhitelist(ip.id)}
                                disabled={!isActive(ip.expires_at)}
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
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
        </Tabs>
      </main>
    </div>
  );
}
