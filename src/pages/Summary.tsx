import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const mockHighlights = [
  {
    id: "1",
    text: "A tecnologia trouxe consigo não apenas a digitalização do conteúdo, mas também novas formas de interação.",
    color: "bg-primary/20 border-primary",
    page: 12,
  },
  {
    id: "2",
    text: "Quando destacamos um trecho de texto, não estamos apenas marcando palavras. Estamos criando uma conexão pessoal com o conteúdo.",
    color: "bg-accent/20 border-accent",
    page: 15,
  },
  {
    id: "3",
    text: "A leitura é para a mente o que o exercício é para o corpo.",
    color: "bg-primary/20 border-primary",
    page: 23,
  },
  {
    id: "4",
    text: "À medida que avançamos nesta era digital, lembremo-nos de que a essência da leitura permanece a mesma.",
    color: "bg-accent/20 border-accent",
    page: 28,
  },
];

const Summary = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleExport = () => {
    toast.success("Resumo exportado com sucesso!");
  };

  const handleShare = () => {
    navigate(`/share/${id}`);
  };

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 mb-8 aura-soft"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/reader/${id}`)}
              className="aura-soft transition-aura"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Resumo e Marcações
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {mockHighlights.length} trechos destacados
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExport}
              className="aura-soft transition-aura"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="aura-soft transition-aura"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Highlights list */}
      <div className="max-w-4xl mx-auto space-y-4">
        {mockHighlights.map((highlight, index) => (
          <motion.div
            key={highlight.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`glass rounded-xl p-6 border-l-4 ${highlight.color} hover:aura-soft transition-aura cursor-pointer`}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-muted-foreground">Página {highlight.page}</span>
              <div className={`w-3 h-3 rounded-full ${highlight.color.split(' ')[0].replace('/20', '')}`} />
            </div>
            <p className="text-foreground leading-relaxed">{highlight.text}</p>
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {mockHighlights.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-12 text-center max-w-2xl mx-auto"
        >
          <p className="text-muted-foreground">
            Você ainda não fez nenhuma marcação neste livro.
            <br />
            Comece destacando trechos importantes durante a leitura!
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default Summary;