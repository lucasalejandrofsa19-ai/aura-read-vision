// deno-lint-ignore-file no-explicit-any
/**
 * Teste de integração para `regenerate-story-video-scene`.
 *
 * Cenário: um `story_videos` do usuário autenticado, com `image_providers`
 * já populado, é referenciado numa chamada de regeneração que falhará
 * (payload de narração muito curto → 400) OU cuja geração de mídia falhará
 * (sem OPENAI/ELEVENLABS keys no ambiente).
 *
 * Invariantes que este teste garante:
 *   1. A função retorna JSON válido (sempre consumimos o body).
 *   2. Após a falha, o row original em `story_videos` permanece com
 *      `image_providers` preenchido (não é limpo).
 *
 * Requer env vars (carregadas via dotenv do .env do projeto):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *   TEST_USER_A_EMAIL   TEST_USER_A_PASSWORD
 *   TEST_STORY_VIDEO_ID (exportado por scripts/seed-story-video-fixture.mjs)
 *
 * Execução:
 *   deno test supabase/functions/regenerate-story-video-scene/index.test.ts \
 *     --allow-net --allow-env --allow-read
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const EMAIL = Deno.env.get("TEST_USER_A_EMAIL");
const PASSWORD = Deno.env.get("TEST_USER_A_PASSWORD");
const STORY_VIDEO_ID = Deno.env.get("TEST_STORY_VIDEO_ID");

const skipReason =
  !SUPABASE_URL || !SUPABASE_ANON || !EMAIL || !PASSWORD || !STORY_VIDEO_ID
    ? "Faltam env vars (rode scripts/seed-story-video-fixture.mjs)."
    : "";

Deno.test({
  name: "regenerate-story-video-scene preserva image_providers após falha",
  ignore: !!skipReason,
  async fn() {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false },
    });
    const { data: auth, error: authErr } = await client.auth.signInWithPassword({
      email: EMAIL!,
      password: PASSWORD!,
    });
    assert(!authErr, `sign-in falhou: ${authErr?.message}`);
    const token = auth!.session!.access_token;

    // Snapshot ANTES da chamada.
    const before = await client
      .from("story_videos")
      .select("status, image_providers")
      .eq("id", STORY_VIDEO_ID!)
      .single();
    assert(!before.error, before.error?.message);
    const providersBefore = (before.data?.image_providers ?? {}) as Record<string, number>;
    assert(Object.keys(providersBefore).length > 0, "fixture sem image_providers");

    // Chamada com narração curta → força 400 antes de tocar em providers,
    // OU chamada real que tentará TTS/imagem e falhará por falta de keys.
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/regenerate-story-video-scene`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON,
        },
        body: JSON.stringify({
          narration: "Teste E2E — este payload pode falhar no TTS/imagem",
          voice: "nova",
          tone: "neutro",
          storyVideoId: STORY_VIDEO_ID,
          audioOnly: true,
        }),
      },
    );
    // SEMPRE consumir o body (regra Deno).
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* ignore */ }
    assert(body !== null, `resposta não-JSON: ${text.slice(0, 200)}`);

    // Não afirmamos status específico (pode ser 200 se as APIs estiverem
    // disponíveis no ambiente, ou 502 sem elas). Afirmamos apenas invariante DB.
    assert(
      res.status === 200 || res.status === 400 || res.status === 502 || res.status === 500,
      `status inesperado: ${res.status} — ${text.slice(0, 200)}`,
    );

    // Snapshot DEPOIS: image_providers NUNCA deve ficar vazio/nulo.
    const after = await client
      .from("story_videos")
      .select("status, image_providers")
      .eq("id", STORY_VIDEO_ID!)
      .single();
    assert(!after.error, after.error?.message);
    const providersAfter = (after.data?.image_providers ?? {}) as Record<string, number>;
    assert(
      providersAfter && Object.keys(providersAfter).length > 0,
      "image_providers foi zerado após falha — regressão!",
    );
    // As chaves originais devem continuar presentes (merge só adiciona).
    for (const key of Object.keys(providersBefore)) {
      assert(
        key in providersAfter,
        `provider "${key}" desapareceu após regenerate (before=${JSON.stringify(providersBefore)} after=${JSON.stringify(providersAfter)})`,
      );
    }
    // status do row seed continua "ok" (não vira "error").
    assertEquals(after.data?.status, "ok");
  },
});
