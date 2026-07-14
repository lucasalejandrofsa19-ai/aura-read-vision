# E2E Autenticados

Specs que rodam com sessão persistida via `e2e/auth.setup.ts` (storageState
em `playwright/.auth/user.json`).

## Env vars

Comuns:

- `E2E_EMAIL` / `E2E_PASSWORD` — login usado pelo `auth.setup.ts`.
- `BASE_URL` — default `https://aura-read.lovable.app`.

Para `regenerateSceneFailure.spec.ts`:

- `TEST_USER_A_EMAIL` / `TEST_USER_A_PASSWORD` — usuário dono do seed.
- `TEST_BOOK_ID`, `TEST_STORY_VIDEO_ID` — exportados pelo script de seed.

## Seed do fixture de story_videos

Antes de rodar o spec de falha da regeneração, popule o fixture:

```bash
node scripts/seed-story-video-fixture.mjs
# em CI, redirecionar para $GITHUB_ENV:
node scripts/seed-story-video-fixture.mjs >> "$GITHUB_ENV"
```

O script é idempotente: reutiliza o mesmo book "RLS Test Book" do
`seed-rls-test-data.mjs` e cria (ou reaproveita) um `story_videos` com
`image_providers = { gemini: 3, lovable: 1 }`.

## Seed do book + highlight para a conta E2E_EMAIL

Specs como `highlightImagePremiumCounter.spec.ts` e
`focusedHighlightZoom.spec.ts` dependem de pelo menos um livro com um
destaque textual pertencente à conta usada em `E2E_EMAIL`. O CI garante
isso automaticamente rodando:

```bash
node scripts/seed-e2e-highlight-fixture.mjs >> "$GITHUB_ENV"
```

Idempotente: reutiliza um `books` "E2E Highlight Fixture" do próprio
usuário e cria/normaliza um `highlights` textual na página 1. Exporta
`E2E_BOOK_ID` e `E2E_HIGHLIGHT_ID` para o `$GITHUB_ENV`.

## Rodar localmente

```bash
export TEST_BOOK_ID=<uuid>
export TEST_STORY_VIDEO_ID=<uuid>
npx playwright test \
  e2e/authenticated/regenerateSceneFailure.spec.ts \
  --project=chromium-auth
```

## Teste de integração Deno correspondente

```bash
deno test supabase/functions/regenerate-story-video-scene/index.test.ts \
  --allow-net --allow-env --allow-read
```

Valida a invariante crítica: mesmo em falha, `image_providers` do row
original NUNCA é zerado (evita regressão dos badges).

## `focusedHighlightZoom.spec.ts`

Valida que a marcação no `FocusedReaderMode` copia o mesmo texto em
100%, 150% e 200% de zoom (equivalência visual × texto extraído).

Requer permissão de clipboard (concedida pelo próprio spec via
`context.grantPermissions`). Usa o primeiro livro visível da Library —
qualquer PDF com texto na primeira página serve.

```bash
npx playwright test \
  e2e/authenticated/focusedHighlightZoom.spec.ts \
  --project=chromium-auth
```

## `highlightImagePremiumCounter.spec.ts`

Valida que:

- Contas **Premium** não exibem o aviso/contador de imagens no
  `HighlightImageDialog`.
- Contas **grátis** continuam vendo o contador ("X gratuitas restantes") e,
  ao atingirem o limite, o alerta com CTA "assine o plano Premium/Pro".

Usa `page.route()` para mockar `/rest/v1/user_roles` (força tier) e
`/rest/v1/highlight_images` com `Prefer: count=exact` (força `imageCount`),
sem depender do papel real do usuário no banco. Requer um livro com pelo
menos um destaque com texto visível em `/summary/:id`; caso contrário o
spec faz `test.skip`.

```bash
npx playwright test \
  e2e/authenticated/highlightImagePremiumCounter.spec.ts \
  --project=chromium-auth
```

