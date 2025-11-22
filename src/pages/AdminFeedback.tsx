import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Suggestion = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  user_id: string;
};

const categoryLabels: Record<string, string> = {
  general: "Geral",
  feature: "Nova Funcionalidade",
  bug: "Bug",
  improvement: "Melhoria",
  ui: "Interface/Design",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  reviewed: "Analisado",
  approved: "Aprovado",
  rejected: "Rejeitado",
  implemented: "Implementado",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  reviewed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  approved: "bg-green-500/10 text-green-500 border-green-500/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
  implemented: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

export default function AdminFeedback() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/library");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchSuggestions();
    }
  }, [isAdmin]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_suggestions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSuggestions(data || []);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      toast.error("Erro ao carregar sugestões");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("user_suggestions")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setSuggestions(
        suggestions.map((s) =>
          s.id === id ? { ...s, status: newStatus } : s
        )
      );
      toast.success("Status atualizado com sucesso");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const deleteSuggestion = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta sugestão?")) return;

    try {
      const { error } = await supabase
        .from("user_suggestions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSuggestions(suggestions.filter((s) => s.id !== id));
      toast.success("Sugestão excluída com sucesso");
    } catch (error) {
      console.error("Error deleting suggestion:", error);
      toast.error("Erro ao excluir sugestão");
    }
  };

  const filteredSuggestions = suggestions.filter((s) => {
    if (filterCategory !== "all" && s.category !== filterCategory) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  if (roleLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Painel Admin
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              <div>
                <CardTitle>Sugestões dos Usuários</CardTitle>
                <CardDescription>
                  Gerencie feedback e sugestões da comunidade
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma sugestão encontrada
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuggestions.map((suggestion) => (
                      <TableRow key={suggestion.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{suggestion.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {suggestion.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {categoryLabels[suggestion.category]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={suggestion.status}
                            onValueChange={(value) =>
                              updateStatus(suggestion.id, value)
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <Badge
                                variant="outline"
                                className={statusColors[suggestion.status]}
                              >
                                {statusLabels[suggestion.status]}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabels).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {format(
                            new Date(suggestion.created_at),
                            "dd/MM/yyyy",
                            { locale: ptBR }
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSuggestion(suggestion.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
      </div>
    </div>
  );
}
