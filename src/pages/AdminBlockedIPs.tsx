import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Ban, Unlock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBlockedIPs } from "@/hooks/useBlockedIPs";
import { useUserData } from "@/hooks/useUserData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminBlockedIPs() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: userLoading } = useUserData();
  const { blockedIPs, loading, blockIP, unblockIP, stats } = useBlockedIPs();
  
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [newBlockIP, setNewBlockIP] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [newBlockDuration, setNewBlockDuration] = useState<string>("24");

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

  return (
    <div className="min-h-screen bg-background">
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
                <h1 className="text-2xl font-bold">IPs Bloqueados</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie IPs bloqueados por atividade suspeita
                </p>
              </div>
            </div>

            <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
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
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
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
        </div>

        {/* Blocked IPs Table */}
        <Card>
          <CardHeader>
            <CardTitle>IPs Bloqueados</CardTitle>
            <CardDescription>
              {blockedIPs.length} IP(s) registrado(s)
            </CardDescription>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => unblockIP(ip.id)}
                            disabled={!isActive(ip.blocked_until)}
                          >
                            <Unlock className="w-4 h-4" />
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
      </main>
    </div>
  );
}
