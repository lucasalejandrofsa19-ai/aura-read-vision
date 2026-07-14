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
