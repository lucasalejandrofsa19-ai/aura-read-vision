import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Brain, Quote, Sparkles, Lightbulb, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";

type Insight = {
  type: "quote" | "fact" | "motivation" | "tip";
  text: string;
  author?: string;
};

const INSIGHTS: Insight[] = [
  // Motivacionais
  { type: "motivation", text: "Um livro por mês transforma sua mente em um ano. Comece hoje a próxima página." },
  { type: "motivation", text: "Cada página lida é um passo a mais de quem você está se tornando." },
  { type: "motivation", text: "Ler 20 minutos por dia equivale a 1 milhão de palavras por ano." },
  { type: "motivation", text: "Você não precisa terminar todos os livros — precisa começar o próximo." },

  // Citações
  { type: "quote", text: "Um leitor vive mil vidas antes de morrer. O que nunca lê vive apenas uma.", author: "George R. R. Martin" },
  { type: "quote", text: "Os livros são abelhas que levam o pólen de uma inteligência a outra.", author: "James Russell Lowell" },
  { type: "quote", text: "Ler é sonhar pela mão de outro.", author: "Fernando Pessoa" },
  { type: "quote", text: "A leitura é para o espírito o que o exercício é para o corpo.", author: "Joseph Addison" },
  { type: "quote", text: "Não há amigo mais leal que um livro.", author: "Ernest Hemingway" },

  // Fatos sobre livros
  { type: "fact", text: "Pessoas que leem regularmente vivem em média 2 anos a mais, segundo estudo da Yale University." },
  { type: "fact", text: "Apenas 6 minutos de leitura reduzem o estresse em até 68% — mais que ouvir música ou caminhar." },
  { type: "fact", text: "O cérebro de um leitor frequente cria novas conexões neurais por dias após terminar um livro." },
  { type: "fact", text: "Ler ficção aumenta a empatia e a capacidade de entender o ponto de vista do outro." },

  // Dicas
  { type: "tip", text: "Marque trechos importantes enquanto lê — depois use o Resumo com IA para revisar tudo em segundos." },
  { type: "tip", text: "Defina uma meta diária pequena (5 páginas). Consistência vence intensidade." },
  { type: "tip", text: "Ouça o audiobook enquanto se desloca — leitura sem ocupar as mãos." },
  { type: "tip", text: "Use o modo foco para mergulhar sem distrações no livro atual." },
];

const ICONS = {
  quote: Quote,
  fact: Brain,
  motivation: Heart,
  tip: Lightbulb,
};

const LABELS = {
  quote: "Citação",
  fact: "Você sabia?",
  motivation: "Inspiração",
  tip: "Dica AURA",
};

export const ReadingInsightsCard = () => {
  const shuffled = useMemo(
    () => [...INSIGHTS].sort(() => Math.random() - 0.5),
    []
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % shuffled.length);
    }, 9000);
    return () => clearInterval(id);
  }, [shuffled.length]);

  const current = shuffled[index];
  const Icon = ICONS[current.type];

  return (
    <Card className="relative overflow-hidden glass border-primary/20 p-5 mb-6">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-start gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {LABELS[current.type]}
            </span>
            <Sparkles className="w-3 h-3 text-primary/60" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-sm sm:text-base text-foreground leading-relaxed">
                {current.text}
              </p>
              {current.author && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  — {current.author}
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-1.5 mt-3">
            {shuffled.slice(0, 6).map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === index % 6 ? "w-6 bg-primary" : "w-1.5 bg-primary/20"
                }`}
              />
            ))}
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="w-3 h-3" />
              <span>Inspiração diária</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
