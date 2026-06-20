// 1.5 fix: enqueue a story-video generation job and return 202 immediately.
// The actual processing happens in `generate-story-video` (worker), triggered
// every 30s by pg_cron. The client polls `public.story_video_jobs` (RLS-scoped)
// to read status/result.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

async function triggerWorker() {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } });
    const { data: secret, error: tokenErr } = await svc.rpc("get_cron_token", { _name: "story_video_worker" });
    if (tokenErr || !secret) { console.error("worker secret missing", tokenErr); return; }
    const r = await fetch(`${url}/functions/v1/generate-story-video`, {
      method: "POST",
      headers: { "x-internal-secret": String(secret), "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await r.text().catch(() => "");
    console.log("worker trigger status", r.status, body.slice(0, 200));
  } catch (e) { console.error("worker trigger ex", e); }
}

const VIDEO_TIMEOUT_MS = 10 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // 1.4 fix: cap body BEFORE parsing.
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > 100_000) {
      return new Response(JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { book_id, mode = "summary", text, voice = "nova", tone = "neutro", scenesCount = 5, variationSeed, scenesOverride } = body as Record<string, unknown>;
    if (!book_id || typeof book_id !== "string") {
      return new Response(JSON.stringify({ error: "book_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Validate optional scenesOverride: max 14 scenes, each with narration text.
    let safeOverride: Array<{ chapterTitle: string; narration: string; imagePrompt?: string; highlightId?: string }> | null = null;
    if (Array.isArray(scenesOverride)) {
      safeOverride = (scenesOverride as any[]).slice(0, 14)
        .map((s) => ({
          chapterTitle: String(s?.chapterTitle ?? "").slice(0, 200),
          narration: String(s?.narration ?? "").slice(0, 1200),
          imagePrompt: s?.imagePrompt ? String(s.imagePrompt).slice(0, 500) : undefined,
          highlightId: s?.highlightId ? String(s.highlightId).slice(0, 64) : undefined,
        }))
        .filter((s) => s.narration.trim().length >= 2);
      if (safeOverride.length === 0) safeOverride = null;
    }


    // Quota check (uses existing SECURITY DEFINER RPC).
    const { data: quota } = await supabaseAdmin.rpc("can_generate_story_video", { _user_id: user.id });
    if (quota && quota.allowed === false) {
      return new Response(JSON.stringify({
        error: "Limite mensal de vídeos atingido. Faça upgrade para Premium para vídeos ilimitados.",
        quota,
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Refuse if user already has a pending/processing job — avoids accidental queue spam.
    const { data: existing } = await supabaseAdmin
      .from("story_video_jobs")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing) {
      const isExpired = Date.now() - new Date(existing.created_at as string).getTime() > VIDEO_TIMEOUT_MS;
      if (isExpired) {
        await supabaseAdmin
          .from("story_video_jobs")
          .update({
            status: "failed",
            error: "Tempo limite excedido. Um novo job pode ser iniciado.",
            processed_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
      EdgeRuntime.waitUntil(triggerWorker());
      return new Response(JSON.stringify({
        job_id: existing.id,
        status: existing.status,
        created_at: existing.created_at,
        message: "Já existe um vídeo sendo gerado para você.",
      }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: job, error: insertErr } = await supabaseAdmin
      .from("story_video_jobs")
      .insert({
        user_id: user.id,
        status: "pending",
        params: { book_id, mode, text, voice, tone, scenesCount, variationSeed: variationSeed ?? null, scenesOverride: safeOverride },
      })
      .select("id, status, created_at")
      .single();

    if (insertErr || !job) {
      console.error("enqueue error", insertErr);
      return new Response(JSON.stringify({ error: "Falha ao enfileirar geração" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    EdgeRuntime.waitUntil(triggerWorker());

    return new Response(JSON.stringify({
      job_id: job.id,
      status: job.status,
      created_at: job.created_at,
      message: "Vídeo enfileirado. Acompanhe pelo job_id.",
    }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-story-video-start error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
