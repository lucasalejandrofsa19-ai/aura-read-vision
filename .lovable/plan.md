## Objetivo

Transformar o AURA READ de um app mobile-first (PWA) em uma experiência desktop-first, priorizando telas grandes (≥1024px) sem quebrar o uso mobile.

## Mudanças principais

### 1. Container global
- Remover o limite `max-width: 1280px` no `#root` (em `src/App.css`) e usar containers mais largos por página (`max-w-7xl`, `max-w-screen-2xl`).
- Definir um wrapper de página padrão com padding generoso em desktop (`px-8 lg:px-12 xl:px-16`).

### 2. Index (landing)
- Hero em grid de 2 colunas em desktop (texto à esquerda, visual/preview à direita) em vez do hero centralizado mobile-first.
- Aumentar tipografia base do hero (`text-6xl lg:text-7xl xl:text-8xl`).
- Seções de features em grid 3-4 colunas em desktop.

### 3. Library
- Layout com **sidebar fixa à esquerda** em desktop (≥lg) contendo: DailyGoalCard, ReadingInsightsCard, filtros, stats.
- Conteúdo principal (grade de livros) ocupa a área maior à direita, com mais colunas em desktop (5-6 colunas em xl em vez de 2-3).
- Em mobile, sidebar colapsa para o topo (comportamento atual preservado).

### 4. Reader
- Layout em 3 colunas em desktop: painel de highlights/notas (esquerda) + PDF centralizado + painel de ferramentas (direita).
- Remover FAB no desktop (controles ficam visíveis nas barras laterais).
- Manter FAB e UI mobile via `lg:hidden`.

### 5. Pricing / Profile
- Cards de planos lado a lado mais largos em desktop.
- Profile com layout 2 colunas (info à esquerda, abas à direita).

### 6. Memory update
- Atualizar `mem://design/mobile-first-priority` para refletir a nova diretriz desktop-first (manter responsividade mobile, mas otimizar para desktop primeiro).
- Atualizar core memory: "Mobile-first PWA" → "Desktop-first responsive web app, PWA opcional".

## Detalhes técnicos

- Breakpoints Tailwind alvo: `lg` (1024px) e `xl` (1280px) como base do design; `sm`/`md` como adaptações.
- Não tocar em lógica de negócio, edge functions, RLS, autenticação, ou pagamentos.
- Manter PWA/Service Worker funcionando (apenas o layout muda).
- Não alterar `src/integrations/supabase/*`.

## Fora do escopo
- Remover funcionalidades PWA.
- Redesign visual (paleta, tipografia, componentes shadcn).
- Mudar fluxos ou regras de negócio.

## Ordem de execução
1. App.css + container global
2. Index (landing)
3. Library (sidebar desktop)
4. Reader (3 colunas desktop)
5. Pricing + Profile
6. Atualizar memória do projeto
