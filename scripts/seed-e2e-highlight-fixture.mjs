#!/usr/bin/env node
/**
 * Seed idempotente para os specs E2E autenticados que dependem de um livro
 * com pelo menos um destaque textual da conta E2E_EMAIL — em particular
 * `e2e/authenticated/highlightImagePremiumCounter.spec.ts` e
 * `e2e/authenticated/focusedHighlightZoom.spec.ts`.
 *
 * Garante:
 *   1. Login (ou signup + login) da conta E2E_EMAIL.
 *   2. Um `books` intitulado "E2E Highlight Fixture" pertencente ao usuário.
 *   3. Um `highlights` com `text` não-vazio ligado ao livro (página 1).
 *
 * Env vars obrigatórias:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *   E2E_EMAIL   E2E_PASSWORD
 *
 * Saídas (stdout, formato $GITHUB_ENV):
 *   E2E_BOOK_ID=<uuid>
 *   E2E_HIGHLIGHT_ID=<uuid>
 *
 * Uso (CI):
 *   node scripts/seed-e2e-highlight-fixture.mjs >> "$GITHUB_ENV"
 */
import { createClient } from "@supabase/supabase-js";

const {
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
  E2E_EMAIL: EMAIL,
  E2E_PASSWORD: PASSWORD,
} = process.env;

const missing = Object.entries({
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
  E2E_EMAIL: EMAIL,
  E2E_PASSWORD: PASSWORD,
}).filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const FIXTURE_TITLE = "E2E Highlight Fixture";
const FIXTURE_TEXT =
  "Trecho de teste E2E para validar marcação, extração e geração de imagem em qualquer nível de zoom.";

const client = createClient(URL, KEY, { auth: { persistSession: false } });

/** Sign in; if the user doesn't exist yet, sign up then sign in. */
async function ensureSignedIn() {
  const { data, error } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (!error) return data.user.id;

  const invalid = /invalid login credentials/i.test(error.message);
  if (!invalid) {
    console.error(`Sign-in failed: ${error.message}`);
    process.exit(1);
  }

  const { error: upErr } = await client.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
  });
  if (upErr && !/already registered/i.test(upErr.message)) {
    console.error(`Sign-up failed: ${upErr.message}`);
    process.exit(1);
  }
  const { data: again, error: again2 } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (again2) {
    console.error(
      `Sign-in after signup failed for ${EMAIL}. Auto-confirm may be disabled. ${again2.message}`,
    );
    process.exit(1);
  }
  return again.user.id;
}

const userId = await ensureSignedIn();

// 1) Reusa/cria o book fixture.
let bookId;
{
  const { data: existing, error: selErr } = await client
    .from("books")
    .select("id")
    .eq("user_id", userId)
    .eq("title", FIXTURE_TITLE)
    .limit(1)
    .maybeSingle();
  if (selErr) { console.error(selErr.message); process.exit(1); }

  if (existing?.id) {
    bookId = existing.id;
  } else {
    const { data, error } = await client
      .from("books")
      .insert({
        user_id: userId,
        title: FIXTURE_TITLE,
        author: "CI Seed",
        file_path: `e2e-fixtures/${userId}/highlight-fixture.pdf`,
        total_pages: 1,
      })
      .select("id")
      .single();
    if (error) { console.error(error.message); process.exit(1); }
    bookId = data.id;
  }
}

// 2) Garante pelo menos um highlight textual ligado ao book.
let highlightId;
{
  const { data: existing, error: selErr } = await client
    .from("highlights")
    .select("id, text")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .limit(1)
    .maybeSingle();
  if (selErr) { console.error(selErr.message); process.exit(1); }

  if (existing?.id && existing.text && existing.text.trim().length > 0) {
    highlightId = existing.id;
  } else if (existing?.id) {
    const { error } = await client
      .from("highlights")
      .update({ text: FIXTURE_TEXT })
      .eq("id", existing.id);
    if (error) { console.error(error.message); process.exit(1); }
    highlightId = existing.id;
  } else {
    const { data, error } = await client
      .from("highlights")
      .insert({
        user_id: userId,
        book_id: bookId,
        page_number: 1,
        text: FIXTURE_TEXT,
        color: "yellow",
        position_data: { x: 0.1, y: 0.1, width: 0.8, height: 0.05 },
      })
      .select("id")
      .single();
    if (error) { console.error(error.message); process.exit(1); }
    highlightId = data.id;
  }
}

console.log(`E2E_BOOK_ID=${bookId}`);
console.log(`E2E_HIGHLIGHT_ID=${highlightId}`);
console.error(`✓ E2E highlight fixture ready. Book=${bookId} Highlight=${highlightId}`);
