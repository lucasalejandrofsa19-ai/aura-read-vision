## Sistema de Gamificação de Leitura

Inspirado no Duolingo: meta diária, streak (sequência), XP, níveis, conquistas e notificações motivacionais para criar hábito de leitura.

### Mecânica principal

- **Meta diária**: usuário define páginas/dia (padrão 10, opções 5/10/20/30/50). Barra de progresso visível.
- **XP por atividade**: +1 XP por página lida, +10 XP por destaque, +25 XP por meta diária batida, +50 XP bônus por completar livro.
- **Streak (sequência)**: dias consecutivos batendo a meta. Quebra se passar 1 dia sem ler. "Streak freeze" como recompensa de nível.
- **Níveis**: progressão por XP total (Iniciante 0, Leitor Casual 100, Leitor 500, Bibliófilo 2000, Mestre 5000+).
- **Conquistas (badges)**: primeira leitura, 7 dias, 30 dias, 100 dias de streak, 10 livros completos, leitor noturno, madrugador, etc.

### Banco de dados

Tabelas novas (RLS em todas, escopo `auth.uid() = user_id`):

- `gamification_stats` (1 por usuário): xp_total, level, current_streak, longest_streak, last_activity_date, daily_goal_pages, freezes_available
- `daily_progress` (1 por usuário/dia): pages_read, xp_earned, goal_met, date
- `achievements` (catálogo público read-only): code, name, description, icon, requirement_type, requirement_value, xp_reward
- `user_achievements`: user_id, achievement_code, unlocked_at

Triggers/funções:
- `award_xp(user_id, amount, reason)` — incrementa XP, recalcula nível, verifica achievements
- `update_streak(user_id)` — chamada quando meta diária é atingida
- `register_pages_read(user_id, book_id, pages)` — atualiza daily_progress, dispara award_xp e update_streak

Reaproveita `reading_sessions` existente para detectar páginas lidas.

### UI

- **Card de progresso diário** no topo da Library: anel circular com páginas lidas / meta, streak (🔥 N dias), XP do dia, nível atual.
- **Página `/conquistas`** (rota nova): grade de badges (desbloqueadas/bloqueadas), histórico de streak, gráfico semanal.
- **Modal de celebração**: ao bater meta diária ou desbloquear conquista (toast animado + confete leve).
- **Onboarding**: ao primeiro login pós-deploy, dialog perguntando meta diária preferida.
- **Lembrete diário**: banner discreto na Library quando o usuário ainda não leu hoje e o streak está em risco.

### Integração

- Hook `useGamification()` centraliza leitura de stats e mutações.
- Hook em `useReadingSession` chama `register_pages_read` ao salvar progresso de leitura.
- Hook em `useHighlights` adiciona +10 XP ao criar destaque.
- Conquistas verificadas via função PL/pgSQL após cada award_xp.

### Arquivos principais a criar

```
src/hooks/useGamification.tsx
src/components/gamification/DailyGoalCard.tsx
src/components/gamification/StreakBadge.tsx
src/components/gamification/XPBar.tsx
src/components/gamification/AchievementUnlockedToast.tsx
src/components/gamification/DailyGoalSetupDialog.tsx
src/pages/Achievements.tsx
supabase/migrations/<gamification>.sql
```

### Detalhes técnicos

- Tudo client-side autenticado (RLS protege). Sem edge functions necessárias.
- Achievements check via trigger AFTER UPDATE em `gamification_stats` e `daily_progress`.
- Timezone: usar `current_date` no Postgres (UTC); aceitável para v1.
- Sem som (constraint do projeto). Animações framer-motion leves só em celebrações pontuais (streak/level up), respeitando o "global animations disabled" para o resto.
- Premium: meta diária ilimitada para todos (incentivo). Conquistas exclusivas premium opcionais (deixar de fora da v1).
