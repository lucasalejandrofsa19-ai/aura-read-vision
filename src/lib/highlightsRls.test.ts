import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration test: verifies RLS on public.highlights.
 *
 * Requires two real test users in the project. Skipped automatically when
 * the credentials aren't provided so CI doesn't fail in environments
 * without secrets.
 *
 * Required env vars:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)
 *   TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD
 *   TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD
 */

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

const USER_A = {
  email: process.env.TEST_USER_A_EMAIL,
  password: process.env.TEST_USER_A_PASSWORD,
};
const USER_B = {
  email: process.env.TEST_USER_B_EMAIL,
  password: process.env.TEST_USER_B_PASSWORD,
};

const TEST_BOOK_ID = process.env.TEST_BOOK_ID;

const ready =
  !!SUPABASE_URL &&
  !!SUPABASE_KEY &&
  !!USER_A.email &&
  !!USER_A.password &&
  !!USER_B.email &&
  !!USER_B.password &&
  !!TEST_BOOK_ID;

const d = ready ? describe : describe.skip;

d("highlights RLS — UPDATE policy", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userAId: string;
  let highlightId: string;

  const seed = {
    book_id: "00000000-0000-0000-0000-000000000000",
    page_number: 1,
    text: "rls-test-original",
    color: "#ffeb3b",
  };

  beforeAll(async () => {
    clientA = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: { persistSession: false },
    });
    clientB = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: a, error: aErr } = await clientA.auth.signInWithPassword({
      email: USER_A.email!,
      password: USER_A.password!,
    });
    if (aErr) throw aErr;
    userAId = a.user!.id;

    const { error: bErr } = await clientB.auth.signInWithPassword({
      email: USER_B.email!,
      password: USER_B.password!,
    });
    if (bErr) throw bErr;

    // Seed: user A owns a highlight. Requires a book row matching seed.book_id,
    // or relax the FK in test data. We attempt insert and skip the test body if it fails.
    const { data: inserted, error: insErr } = await clientA
      .from("highlights")
      .insert({ ...seed, user_id: userAId })
      .select()
      .single();
    if (insErr) throw insErr;
    highlightId = inserted.id;
  });

  afterAll(async () => {
    if (highlightId) {
      await clientA.from("highlights").delete().eq("id", highlightId);
    }
  });

  it("owner CAN update their own highlight", async () => {
    const { data, error } = await clientA
      .from("highlights")
      .update({ text: "rls-test-updated-by-owner" })
      .eq("id", highlightId)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].text).toBe("rls-test-updated-by-owner");
  });

  it("non-owner CANNOT update someone else's highlight (RLS filters the row out)", async () => {
    const { data, error } = await clientB
      .from("highlights")
      .update({ text: "hacked-by-user-b" })
      .eq("id", highlightId)
      .select();

    // Postgres RLS makes the row invisible to UPDATE, so the call succeeds
    // but affects zero rows. A subsequent owner read confirms no mutation.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: check } = await clientA
      .from("highlights")
      .select("text")
      .eq("id", highlightId)
      .single();
    expect(check?.text).not.toBe("hacked-by-user-b");
  });

  it("anonymous client CANNOT update any highlight", async () => {
    const anon = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await anon
      .from("highlights")
      .update({ text: "hacked-by-anon" })
      .eq("id", highlightId)
      .select();

    // Either explicit RLS error, or zero rows affected. Both prove the
    // policy is denying the write.
    if (error) {
      expect(error.message.toLowerCase()).toMatch(/row-level|permission|denied/);
    } else {
      expect(data ?? []).toHaveLength(0);
    }
  });
});
