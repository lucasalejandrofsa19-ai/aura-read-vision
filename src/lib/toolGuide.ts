/**
 * Textos padronizados de tooltips de ferramentas.
 * Mantém título, descrição curta e âncora alinhados com a página /guia (src/pages/Guide.tsx).
 * Sempre que o Guia mudar, ajuste aqui para manter a mesma linguagem em toda a UI.
 */
export interface ToolCopy {
  title: string;
  description: string;
  guideAnchor: string;
  premium?: boolean;
}

export const TOOL_COPY = {
  highlight: {
    title: "Marcação de texto",
    description: "Destaque trechos e tenha o texto extraído automaticamente.",
    guideAnchor: "Marcação de texto",
  },
  highlightsList: {
    title: "Marcação de texto",
    description: "Destaque trechos e tenha o texto extraído automaticamente.",
    guideAnchor: "Marcação de texto",
  },
  bookmark: {
    title: "Leitor de PDF",
    description: "Leia com zoom, navegação por página e modo focado.",
    guideAnchor: "Leitor de PDF",
  },
  aiSummary: {
    title: "Resumo com IA",
    description: "Gere resumos completos dos seus destaques ou do livro.",
    guideAnchor: "Resumo com IA",
    premium: true,
  },
  share: {
    title: "Compartilhar",
    description: "Envie destaques e livros para outras pessoas.",
    guideAnchor: "Compartilhar",
  },
  focusedReader: {
    title: "Leitor de PDF",
    description: "Leia com zoom, navegação por página e modo focado.",
    guideAnchor: "Leitor de PDF",
  },
  presentation: {
    title: "Modo apresentação",
    description: "Use o livro em projeções ou aulas.",
    guideAnchor: "Modo apresentação",
  },
} as const satisfies Record<string, ToolCopy>;
