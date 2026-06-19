#!/usr/bin/env node
/**
 * Provisions the two test users + a seed book required by
 * src/lib/highlightsRls.test.ts.
 *
 * Idempotent: re-runs are safe. Users are created if missing, otherwise
 * the existing accounts are reused. A book owned by user A is created
 * only if user A has none.
 *
 * Required env vars:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY (anon/publishable key)
 *   TEST_USER_A_EMAIL  TEST_USER_A_PASSWORD
 *   TEST_USER_B_EMAIL  TEST_USER_B_PASSWORD
 *
 * Outputs (stdout) extra GitHub-Actions-friendly env lines:
 *   TEST_BOOK_ID=<uuid>
 *
 * Usage (CI):
 *   node scripts/seed-rls-test-data.mjs >> "$GITHUB_ENV"
 */
import { createClient } from "@supabase/supabase-js";

const {
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
  TEST_USER_A_EMAIL: A_EMAIL,
  TEST_USER_A_PASSWORD: A_PASS,
  TEST_USER_B_EMAIL: B_EMAIL,
  TEST_USER_B_PASSWORD: B_PASS,
} = process.env;

const missing = Object.entries({
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
  TEST_USER_A_EMAIL: A_EMAIL,
  TEST_USER_A_PASSWORD: A_PASS,
  TEST_USER_B_EMAIL: B_EMAIL,
  TEST_USER_B_PASSWORD: B_PASS,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

/** Sign in; if the user doesn't exist, sign up then sign in. */
async function ensureUser(email, password) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (!error) return { client, userId: data.user.id, created: false };

  const isInvalid = /invalid login credentials/i.test(error.message);
  if (!isInvalid) throw error;

  const { error: upErr } = await client.auth.signUp({ email, password });
  if (upErr && !/already registered/i.test(upErr.message)) throw upErr;

  const { data: again, error: again2 } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (again2) {
    throw new Error(
      `Could not sign in after signup for ${email}. Auto-confirm may be disabled. ${again2.message}`,
    );
  }
  return { client, userId: again.user.id, created: true };
}

async function ensureBookForUserA(clientA, userAId) {
  const { data: existing, error: selErr } = await clientA
    .from("books")
    .select("id")
    .eq("user_id", userAId)
    .eq("title", "RLS Test Book")
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing?.id) return existing.id;

  const { data, error } = await clientA
    .from("books")
    .insert({
      user_id: userAId,
      title: "RLS Test Book",
      author: "CI Seed",
      file_path: `rls-test/${userAId}.pdf`,
      total_pages: 1,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const { client: clientA, userId: userAId } = await ensureUser(A_EMAIL, A_PASS);
await ensureUser(B_EMAIL, B_PASS);
const bookId = await ensureBookForUserA(clientA, userAId);

console.log(`TEST_BOOK_ID=${bookId}`);
console.error(`✓ Seed complete. User A: ${userAId}  Book: ${bookId}`);
