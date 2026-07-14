#!/usr/bin/env node
/**
 * Seed idempotente para o E2E de regenerate-story-video-scene:
 * garante um `story_videos` (status=ok, image_providers preenchido) associado
 * a um book do TEST_USER_A_EMAIL.
 *
 * Env vars obrigatórias:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *   TEST_USER_A_EMAIL   TEST_USER_A_PASSWORD
 *
 * Saídas (stdout, formato $GITHUB_ENV):
 *   TEST_BOOK_ID=<uuid>
 *   TEST_STORY_VIDEO_ID=<uuid>
 *
 * Uso:
 *   node scripts/seed-story-video-fixture.mjs >> "$GITHUB_ENV"
 */
import { createClient } from "@supabase/supabase-js";

const {
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
  TEST_USER_A_EMAIL: EMAIL,
  TEST_USER_A_PASSWORD: PASSWORD,
} = process.env;

const missing = Object.entries({
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
  TEST_USER_A_EMAIL: EMAIL,
  TEST_USER_A_PASSWORD: PASSWORD,
}).filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const client = createClient(URL, KEY, { auth: { persistSession: false } });
const { data: auth, error: authErr } = await client.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
if (authErr) {
  console.error(`Sign-in failed: ${authErr.message}`);
  process.exit(1);
}
const userId = auth.user.id;

// 1) Reusa/cria o mesmo "RLS Test Book".
let bookId;
{
  const { data: existing } = await client
    .from("books").select("id").eq("user_id", userId)
    .eq("title", "RLS Test Book").limit(1).maybeSingle();
  if (existing?.id) {
    bookId = existing.id;
  } else {
    const { data, error } = await client
      .from("books")
      .insert({
        user_id: userId,
        title: "RLS Test Book",
        author: "CI Seed",
        file_path: `rls-test/${userId}.pdf`,
        total_pages: 1,
      })
      .select("id").single();
    if (error) { console.error(error.message); process.exit(1); }
    bookId = data.id;
  }
}

// 2) Garante um story_videos com badges preenchidos.
const FIXTURE_TITLE = "E2E Regenerate Fixture";
let storyVideoId;
{
  const { data: existing } = await client
    .from("story_videos").select("id, image_providers")
    .eq("user_id", userId).eq("book_id", bookId)
    .eq("book_title", FIXTURE_TITLE).limit(1).maybeSingle();
  if (existing?.id) {
    storyVideoId = existing.id;
    // Garante que image_providers ainda está preenchido (reforça idempotência).
    if (!existing.image_providers || Object.keys(existing.image_providers).length === 0) {
      await client.from("story_videos")
        .update({ image_providers: { gemini: 3, lovable: 1 } })
        .eq("id", storyVideoId);
    }
  } else {
    const { data, error } = await client
      .from("story_videos")
      .insert({
        user_id: userId,
        book_id: bookId,
        book_title: FIXTURE_TITLE,
        mode: "summary",
        status: "ok",
        scenes_count: 4,
        image_providers: { gemini: 3, lovable: 1 },
      })
      .select("id").single();
    if (error) { console.error(error.message); process.exit(1); }
    storyVideoId = data.id;
  }
}

console.log(`TEST_BOOK_ID=${bookId}`);
console.log(`TEST_STORY_VIDEO_ID=${storyVideoId}`);
console.error(`✓ Fixture ready. Book=${bookId} StoryVideo=${storyVideoId}`);
