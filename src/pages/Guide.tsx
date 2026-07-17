import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  BookOpen,
  Highlighter,
  StickyNote,
  Sparkles,
  Headphones,
  Search,
  Share2,
  FileText,
  GraduationCap,
  Trophy,
  CreditCard,
  Download,
  Crown,
  Image as ImageIcon,
  Presentation,
  Target,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import LibraryCTA from "@/components/LibraryCTA";

interface Tool {
  icon: typeof Upload;
  title: string;
  short: string;
  premium?: boolean;
  steps: string[];
}

const quickStart: { icon: typeof Upload; title: string; description: string }[] = [
  { icon: Upload, title: "1. Envie um PDF", description: "Na biblioteca, clique em 'Adicionar livro' e selecione um PDF (até 10MB)." },
  { icon: BookOpen, title: "2. Abra para ler", description: "Clique no card do livro. O leitor abre com zoom, navegação e ferramentas." },
  { icon: Highlighter, title: "3. Marque trechos", description: "Selecione áreas do texto. O conteúdo é extraído e copiado automaticamente." },
  { icon: Sparkles, title: "4. Use a IA", description: "Gere resumos, aprofunde tópicos e crie imagens a partir dos seus destaques." },
];

const tools: Tool[] = [
  {
    icon: Upload,
    title: "Upload de PDFs",
    short: "Adicione livros à sua biblioteca pessoal.",
    steps: [
      "Vá até a Biblioteca e clique em 'Adicionar livro'.",
      "Escolha um arquivo PDF (limite de 10MB por arquivo).",
      "Aguarde o processamento — uma capa será gerada automaticamente a partir da primeira página.",
      "O livro aparece na sua coleção pessoal, pronto para leitura offline.",
    ],
  },
  {
    icon: BookOpen,
    title: "Leitor de PDF",
    short: "Leia com zoom, navegação por página e modo focado.",
    steps: [
      "Clique em um livro da biblioteca para abrir o leitor.",
      "Use as setas ou os botões de navegação para mudar de página.",
      "Ajuste o zoom com os botões + / − (a sensibilidade fica salva no seu perfil).",
      "Ative o modo focado para esconder distrações e ler em tela cheia.",
    ],
  },
  {
    icon: Highlighter,
    title: "Marcação de texto",
    short: "Destaque trechos e tenha o texto extraído automaticamente.",
    steps: [
      "No leitor, arraste para desenhar uma marcação amarela sobre o texto.",
      "O texto da área é extraído com PDF.js e copiado para sua área de transferência.",
      "Os destaques ficam salvos por livro e podem ser revisados depois.",
      "No mobile, basta tocar e arrastar — o gesto de pinça está desativado para evitar conflitos.",
    ],
  },
  {
    icon: StickyNote,
    title: "Anotações",
    short: "Escreva notas vinculadas a páginas do livro.",
    steps: [
      "Abra o painel de notas dentro do leitor.",
      "Adicione uma nota livre referente à página atual.",
      "Edite ou apague suas notas a qualquer momento — ficam sincronizadas na nuvem.",
    ],
  },
  {
    icon: Search,
    title: "Busca no PDF",
    short: "Encontre palavras dentro do livro.",
    steps: [
      "Abra a barra de busca no leitor.",
      "Digite o termo desejado e navegue pelos resultados encontrados.",
    ],
  },
  {
    icon: Sparkles,
    title: "Resumo com IA",
    premium: true,
    short: "Gere resumos completos dos seus destaques ou do livro.",
    steps: [
      "Selecione 'Resumo' a partir dos seus destaques ou da página do livro.",
      "Usuários gratuitos veem uma prévia de 50 palavras como demonstração.",
      "Assinantes Premium recebem o resumo completo gerado por IA (Gemini).",
      "Você pode exportar o resultado em PDF ou Word (recurso Premium).",
    ],
  },
  {
    icon: GraduationCap,
    title: "Resumo Acadêmico",
    premium: true,
    short: "Versão estruturada para estudos, com tópicos e referências.",
    steps: [
      "Acesse 'Resumo Acadêmico' pelo ícone de capelo na biblioteca.",
      "Escolha o livro e o nível de aprofundamento desejado.",
      "Receba um material formatado para estudo, ideal para o plano Estudante.",
    ],
  },
  {
    icon: ImageIcon,
    title: "Imagens a partir de destaques",
    premium: true,
    short: "Transforme um trecho marcado em uma imagem ilustrativa.",
    steps: [
      "Na página de resumo, selecione um destaque.",
      "Clique em 'Gerar imagem' — a IA cria uma ilustração baseada no texto.",
      "Baixe ou compartilhe a imagem gerada.",
    ],
  },
  {
    icon: Headphones,
    title: "Audiolivro (TTS)",
    short: "Ouça seus livros com narração por voz.",
    steps: [
      "Abra um livro e ative o player de audiolivro.",
      "Por padrão usamos a voz do navegador (gratuito e offline).",
      "Premium libera narração com IA de alta qualidade e cache em nuvem.",
      "A posição e velocidade da leitura são salvas automaticamente.",
    ],
  },
  {
    icon: Presentation,
    title: "Modo apresentação",
    short: "Use o livro em projeções ou aulas.",
    steps: [
      "Ative o modo apresentação no leitor.",
      "Navegue entre páginas e use zoom — mantemos a interface limpa, sem ferramentas extras.",
    ],
  },
  {
    icon: Share2,
    title: "Compartilhar",
    short: "Envie destaques e livros para outras pessoas.",
    steps: [
      "Em um destaque ou livro, clique em 'Compartilhar'.",
      "Gere um link público de leitura ou copie o conteúdo formatado.",
    ],
  },
  {
    icon: FileText,
    title: "Exportação de destaques",
    premium: true,
    short: "Baixe todos os seus destaques em PDF ou Word.",
    steps: [
      "Acesse a lista de destaques de um livro.",
      "Clique em 'Exportar' e escolha o formato (PDF ou DOCX).",
      "Pré-visualize, reordene e edite antes de baixar.",
    ],
  },
  {
    icon: Target,
    title: "Metas e gamificação",
    short: "Crie hábito de leitura com XP, sequências e conquistas.",
    steps: [
      "Defina sua meta diária de páginas no card 'Meta diária'.",
      "A cada sessão você ganha XP, sobe de nível e mantém sua sequência (streak).",
      "Veja todas as conquistas desbloqueadas na página 'Conquistas'.",
    ],
  },
  {
    icon: Trophy,
    title: "Estatísticas de leitura",
    short: "Acompanhe páginas lidas, tempo e livros concluídos.",
    steps: [
      "Abra o card de estatísticas na biblioteca ou no perfil.",
      "Veja totais de páginas, tempo de sessão e livros finalizados.",
    ],
  },
  {
    icon: CreditCard,
    title: "Planos e assinatura",
    short: "Pro, Estudante e Premium liberam recursos avançados.",
    steps: [
      "Vá em 'Assinar Premium' no topo da biblioteca.",
      "Compare os planos: Pro (R$ 19,90), Estudante (R$ 29,90) e Premium (R$ 39,90).",
      "Pague com cartão via checkout seguro — a liberação é automática.",
      "Gerencie ou cancele a qualquer momento no Portal do Cliente.",
    ],
  },
  {
    icon: Download,
    title: "Instalar como app (PWA)",
    short: "Use a AURA READ como aplicativo no seu dispositivo.",
    steps: [
      "Clique no ícone da AURA READ no topo da biblioteca.",
      "Siga as instruções para instalar no desktop ou celular.",
      "Atualizações chegam em segundo plano, sem precisar reinstalar.",
    ],
  },
];

const Guide = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="Guia de uso — AURA READ"
        description="Aprenda passo a passo como usar cada ferramenta da AURA READ: upload, leitor, marcações, resumos com IA, audiolivros e mais."
        path="/guia"
      />
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <div className="mx-auto w-full max-w-screen-xl p-4 sm:p-6 lg:p-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <Button variant="outline" onClick={() => navigate("/library")}>
              Ir para Biblioteca
            </Button>
          </div>

          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
              Guia de uso da AURA READ
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tudo o que você precisa para começar — passo a passo, com explicação de cada ferramenta.
            </p>
          </motion.header>

          {/* Quick start */}
          <section className="reveal-on-scroll mb-14">
            <h2 className="text-2xl font-semibold mb-6">Comece em 4 passos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickStart.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`reveal-on-scroll reveal-delay-${Math.min(i + 1, 4)}`}
                >
                  <Card className="h-full glass border-primary/20 aura-soft">
                    <CardHeader>
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-2">
                        <step.icon className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{step.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{step.description}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Tools */}
          <section className="mb-14">
            <h2 className="text-2xl font-semibold mb-2">Ferramentas em detalhe</h2>
            <p className="text-muted-foreground mb-6">
              Clique em cada ferramenta para ver o passo a passo completo.
            </p>

            <Accordion type="single" collapsible className="space-y-3">
              {tools.map((tool) => (
                <AccordionItem
                  key={tool.title}
                  value={tool.title}
                  id={tool.title}
                  className="glass border border-primary/10 rounded-xl px-4 aura-soft scroll-mt-24"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center shrink-0">
                        <tool.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{tool.title}</span>
                          {tool.premium && (
                            <Badge variant="secondary" className="gap-1">
                              <Crown className="w-3 h-3" />
                              Premium
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-normal">{tool.short}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-foreground/90 pl-12">
                      {tool.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* CTA */}
          <section>
            <LibraryCTA />
          </section>
        </div>
      </div>
    </>
  );
};

export default Guide;
