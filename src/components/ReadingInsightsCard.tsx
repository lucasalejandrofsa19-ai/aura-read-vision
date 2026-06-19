import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Brain, Quote, Sparkles, Lightbulb, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Insight = {
  type: "quote" | "fact" | "motivation" | "tip";
  text: string;
  author?: string;
  source?: string;
};

const INSIGHTS: Insight[] = [
  // ===== FATOS COMPROVADOS POR ESTUDOS =====
  {
    type: "fact",
    text: "Apenas 6 minutos de leitura por dia reduzem o nível de estresse em até 68% — mais eficaz que ouvir música, caminhar ou tomar uma xícara de chá.",
    source: "Universidade de Sussex, Dr. David Lewis (2009)",
  },
  {
    type: "fact",
    text: "Pessoas que leem livros vivem em média 23 meses a mais do que quem não lê. Ler 30 minutos por dia reduz a mortalidade em 20%.",
    source: "Yale School of Public Health (2016), com 3.635 participantes acompanhados por 12 anos",
  },
  {
    type: "fact",
    text: "Ler ficção literária aumenta mensuravelmente a empatia e a Teoria da Mente — a capacidade de entender o que outras pessoas pensam e sentem.",
    source: "Estudo de Kidd & Castano publicado na revista Science (2013)",
  },
  {
    type: "fact",
    text: "A leitura regular pode atrasar o declínio cognitivo em até 32% e reduz significativamente o risco de Alzheimer na velhice.",
    source: "Estudo do Rush University Medical Center (2013)",
  },
  {
    type: "fact",
    text: "Crianças expostas a livros desde cedo ouvem em média 1,4 milhão de palavras a mais que outras até os 5 anos — o chamado 'efeito Matthew' da leitura.",
    source: "Logan, Justice et al., Ohio State University (2019)",
  },
  {
    type: "fact",
    text: "Ler antes de dormir melhora a qualidade do sono. Trocar a tela por um livro impresso por 30 minutos aumenta a satisfação com o sono.",
    source: "Estudo publicado em Trials Journal (2021)",
  },
  {
    type: "fact",
    text: "O cérebro de quem lê ficção mantém maior conectividade neural no córtex temporal esquerdo por até 5 dias após terminar o livro.",
    source: "Universidade Emory, Berns et al. (2013)",
  },
  {
    type: "fact",
    text: "Adultos que leem por prazer têm vocabulário até 50% maior e melhor memória de trabalho do que os que não leem.",
    source: "OECD — Programa de Avaliação Internacional de Competências (PIAAC)",
  },
  {
    type: "fact",
    text: "Mesmo quem lê apenas 1 capítulo por dia termina, em média, mais de 20 livros por ano — sem precisar de muito tempo.",
  },

  // ===== CITAÇÕES REAIS =====
  {
    type: "quote",
    text: "Um leitor vive mil vidas antes de morrer. O homem que nunca lê vive apenas uma.",
    author: "George R. R. Martin",
  },
  {
    type: "quote",
    text: "Ler é sonhar pela mão de outro.",
    author: "Fernando Pessoa",
  },
  {
    type: "quote",
    text: "A leitura é para o espírito o que o exercício é para o corpo.",
    author: "Joseph Addison",
  },
  {
    type: "quote",
    text: "Quem lê muito e anda muito, vê muito e sabe muito.",
    author: "Miguel de Cervantes",
  },
  {
    type: "quote",
    text: "Não há amigo mais leal que um livro.",
    author: "Ernest Hemingway",
  },
  {
    type: "quote",
    text: "Um livro deve ser o machado para o mar congelado dentro de nós.",
    author: "Franz Kafka",
  },
  {
    type: "quote",
    text: "Os livros são espelhos: você só vê neles aquilo que já traz dentro de si.",
    author: "Carlos Ruiz Zafón",
  },
  {
    type: "quote",
    text: "Ler é a melhor forma de viajar.",
    author: "Vou-te contar, Marc Levy",
  },
  {
    type: "quote",
    text: "Uma sala sem livros é como um corpo sem alma.",
    author: "Cícero",
  },
  {
    type: "quote",
    text: "Tu te tornas eternamente responsável por aquilo que cativas — inclusive pelos livros que te transformam.",
    author: "Antoine de Saint-Exupéry",
  },

  // ===== MOTIVAÇÕES =====
  {
    type: "motivation",
    text: "Você não precisa terminar todos os livros que começa. Precisa apenas começar o próximo.",
  },
  {
    type: "motivation",
    text: "20 minutos de leitura por dia equivalem a aproximadamente 1,8 milhão de palavras por ano — o equivalente a 18 livros completos.",
  },
  {
    type: "motivation",
    text: "Cada página é um passo a mais de quem você está se tornando. A leitura é o investimento com maior retorno do mundo.",
  },
  {
    type: "motivation",
    text: "Um livro por mês transforma sua mente em um ano. Doze livros podem mudar uma vida inteira.",
  },
  {
    type: "motivation",
    text: "O hábito da leitura nunca é tarde. Comece com 5 páginas hoje — a consistência supera a intensidade.",
  },

  // ===== DICAS PRÁTICAS =====
  {
    type: "tip",
    text: "Marque trechos importantes durante a leitura e depois use o Resumo com IA para revisar tudo em segundos.",
  },
  {
    type: "tip",
    text: "Defina uma meta diária pequena — 5 páginas. É melhor ler pouco todo dia do que muito uma vez por mês.",
  },
  {
    type: "tip",
    text: "Use o audiobook enquanto se desloca, cozinha ou caminha — você 'lê' sem ocupar as mãos.",
  },
  {
    type: "tip",
    text: "Ative o modo foco para mergulhar no livro atual sem distrações. A atenção plena multiplica a retenção.",
  },
  {
    type: "tip",
    text: "Tenha sempre um livro acessível no celular. 10 minutos de espera = 5 páginas a mais por dia.",
  },
  {
    type: "tip",
    text: "Releia trechos marcados após 1 semana — a repetição espaçada aumenta a retenção em até 200%.",
  },
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

const ACCENT = {
  quote: "from-primary to-accent",
  fact: "from-primary to-primary/60",
  motivation: "from-accent to-primary",
  tip: "from-accent to-accent/60",
};

export const ReadingInsightsCard = () => {
  const shuffled = useMemo(
    () => [...INSIGHTS].sort(() => Math.random() - 0.5),
    []
  );
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % shuffled.length);
    }, 10000);
    return () => clearInterval(id);
  }, [shuffled.length, paused]);

  const current = shuffled[index];
  const Icon = ICONS[current.type];
  const gradient = ACCENT[current.type];

  const next = () => setIndex((i) => (i + 1) % shuffled.length);
  const prev = () => setIndex((i) => (i - 1 + shuffled.length) % shuffled.length);

  return (
    <Card
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg shadow-background/40 p-5 min-h-[240px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-3xl pointer-events-none transition-all duration-700`} />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col gap-4">
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md shadow-primary/20`}>
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>

        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs sm:text-sm font-bold uppercase tracking-wider bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                {LABELS[current.type]}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-primary/60" />
            </div>
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Inspiração diária • {index + 1}/{shuffled.length}</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45 }}
            >
              <p className="text-sm sm:text-base text-foreground leading-relaxed font-medium">
                {current.text}
              </p>
              {current.author && (
                <p className="text-sm text-muted-foreground mt-3 italic">
                  — {current.author}
                </p>
              )}
              {current.source && (
                <p className="text-xs text-muted-foreground/80 mt-2 flex items-center gap-1.5">
                  <span className="inline-block w-1 h-1 rounded-full bg-primary/50" />
                  Fonte: {current.source}
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-border/40">
            <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
              {shuffled.slice(0, 8).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    i === index % 8 ? `w-8 bg-gradient-to-r ${gradient}` : "w-1.5 bg-primary/20"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={prev} className="h-8 w-8" aria-label="Anterior">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={next} className="h-8 w-8" aria-label="Próximo">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
