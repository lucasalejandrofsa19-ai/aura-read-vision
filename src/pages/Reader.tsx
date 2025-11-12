import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Highlighter,
  Bookmark,
  Palette,
  FileText,
  Share2,
  BookmarkCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const mockContent = `
# Capítulo 1: O Começo

Era uma vez, em um tempo não muito distante, uma revolução silenciosa começou a transformar a forma como as pessoas interagiam com o conhecimento. Os livros, que por séculos foram impressos em papel, começaram a ganhar vida digital.

## A Nova Era da Leitura

A tecnologia trouxe consigo não apenas a digitalização do conteúdo, mas também novas formas de interação. Marca-textos digitais, anotações instantâneas, compartilhamento de trechos - tudo isso se tornou parte da experiência de leitura moderna.

### Características da Leitura Digital

1. **Portabilidade**: Milhares de livros em um único dispositivo
2. **Interatividade**: Destaque, anote, compartilhe
3. **Personalização**: Ajuste o ambiente de leitura ao seu gosto
4. **Conectividade**: Compartilhe insights com a comunidade

## O Poder do Destaque

Quando destacamos um trecho de texto, não estamos apenas marcando palavras. Estamos criando uma conexão pessoal com o conteúdo, sinalizando ideias que ressoam conosco, construindo nosso próprio mapa de conhecimento.

### Por que Destacar?

Os destaques servem como:
- Marcadores de ideias importantes
- Lembretes para reflexão futura
- Material para revisão
- Base para compartilhamento de conhecimento

## A Jornada Continua

Este é apenas o começo de uma longa jornada através do conhecimento. Cada página virada, cada trecho destacado, cada nota feita - tudo contribui para a construção do seu entendimento único do mundo.

### Próximos Passos

Continue explorando, questionando, destacando. Faça deste livro uma extensão do seu pensamento. Use as ferramentas disponíveis para criar uma experiência de leitura verdadeiramente sua.

---

*"A leitura é para a mente o que o exercício é para o corpo."* - Joseph Addison

## Reflexões Finais

À medida que avançamos nesta era digital, lembremo-nos de que a essência da leitura permanece a mesma: a busca pelo conhecimento, o prazer da descoberta, a alegria de aprender. A tecnologia é apenas uma ferramenta para amplificar essa experiência milenar.
`;

const Reader = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [backgroundColor, setBackgroundColor] = useState("bg-background");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBook();
  }, [id]);

  const loadBook = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setBook(data);
    } catch (error) {
      console.error("Error loading book:", error);
      toast.error("Erro ao carregar livro");
      navigate("/library");
    } finally {
      setLoading(false);
    }
  };

  const backgrounds = [
    { name: "Grafite", class: "bg-background", color: "Escuro" },
    { name: "Papel Velho", class: "bg-paper", color: "Claro" },
    { name: "Safira", class: "bg-card", color: "Azul" },
    { name: "Âmbar", class: "bg-amber-950", color: "Âmbar" },
  ];

  const handleHighlight = () => {
    if (window.getSelection) {
      const selection = window.getSelection();
      const text = selection?.toString();
      if (text) {
        setSelectedText(text);
        toast.success("Trecho destacado com sucesso!");
      } else {
        toast.info("Selecione um texto para destacar");
      }
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    toast.success(isBookmarked ? "Marcador removido" : "Página marcada!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!book) return null;

  const content = book.extracted_text || mockContent;

  return (
    <div className={`min-h-screen ${backgroundColor} transition-colors duration-500`}>
      {/* Toolbar */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass sticky top-0 z-50 border-b border-border/50"
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/library")}
              className="aura-soft transition-aura"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">{book.title}</h1>
              <p className="text-xs text-muted-foreground">{book.author || "Autor Desconhecido"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleHighlight}
              className="aura-soft transition-aura"
            >
              <Highlighter className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleBookmark}
              className={`transition-aura ${isBookmarked ? "text-accent aura-amber" : "aura-soft"}`}
            >
              {isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="aura-soft transition-aura">
                  <Palette className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass">
                {backgrounds.map((bg) => (
                  <DropdownMenuItem
                    key={bg.name}
                    onClick={() => setBackgroundColor(bg.class)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded ${bg.class} border border-border`} />
                      <span>{bg.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/summary/" + id)}
              className="aura-soft transition-aura"
            >
              <FileText className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/share/" + id)}
              className="aura-soft transition-aura"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-3xl mx-auto px-6 py-12"
      >
        <div className="prose prose-lg prose-invert max-w-none select-text">
          {content.split('\n').map((line, index) => {
            if (line.startsWith('# ')) {
              return (
                <h1 key={index} className="text-4xl font-bold mb-6 text-foreground">
                  {line.substring(2)}
                </h1>
              );
            } else if (line.startsWith('## ')) {
              return (
                <h2 key={index} className="text-3xl font-bold mt-12 mb-4 text-foreground">
                  {line.substring(3)}
                </h2>
              );
            } else if (line.startsWith('### ')) {
              return (
                <h3 key={index} className="text-2xl font-bold mt-8 mb-3 text-foreground">
                  {line.substring(4)}
                </h3>
              );
            } else if (line.startsWith('*') && line.endsWith('*')) {
              return (
                <p key={index} className="italic text-center text-muted-foreground my-8">
                  {line.substring(1, line.length - 1)}
                </p>
              );
            } else if (line.startsWith('-')) {
              return (
                <li key={index} className="ml-6 text-foreground">
                  {line.substring(2)}
                </li>
              );
            } else if (line.startsWith('---')) {
              return <hr key={index} className="my-8 border-border" />;
            } else if (line.trim() !== '') {
              return (
                <p key={index} className="mb-4 leading-relaxed text-foreground/90">
                  {line}
                </p>
              );
            }
            return null;
          })}
        </div>
      </motion.main>
    </div>
  );
};

export default Reader;