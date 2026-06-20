// 1.5 fix: worker mode. Invoked by pg_cron every 30s (or directly for debug).
// Auth: requires `x-internal-secret` header matching INTERNAL_FUNCTION_SECRET.
// Pulls 1 pending job atomically via claim_next_story_video_job(), processes,
// writes result/error back to story_video_jobs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface ChapterSegment {
  text: string;
  imagePrompt: string;
}

interface ChapterScene {
  chapterTitle: string;
  segments: ChapterSegment[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Worker auth: validates `x-internal-secret` against a server-stored token
  // in `private.cron_tokens`. Only pg_cron (and admins with DB access) know it.
  const providedSecret = req.headers.get("x-internal-secret") || "";
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false }, db: { schema: "private" } as any }
  );
  // Use a separate client for non-private queries (default public schema).
  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const { data: tokenRow } = await supabaseClient
    .from("cron_tokens")
    .select("token")
    .eq("name", "story_video_worker")
    .maybeSingle();

  if (!tokenRow?.token || providedSecret !== tokenRow.token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }


  // Atomically claim the next pending job.
  const { data: job, error: claimErr } = await sb.rpc("claim_next_story_video_job");
  if (claimErr) {
    console.error("claim error", claimErr);
    return new Response(JSON.stringify({ error: claimErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!job) {
    return new Response(JSON.stringify({ idle: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const jobId: string = job.id;
  const userId: string = job.user_id;
  const params = (job.params || {}) as Record<string, unknown>;
  const book_id = params.book_id as string;
  const mode = (params.mode as string) || "summary";
  const clientText = params.text as string | undefined;
  const voice = (params.voice as string) || "nova";
  const scenesCount = Number(params.scenesCount) || 5;
  const variationSeed = params.variationSeed as number | null | undefined;

  const markFailed = async (msg: string) => {
    await sb.from("story_video_jobs").update({
      status: "failed",
      error: msg,
      processed_at: new Date().toISOString(),
    }).eq("id", jobId);
  };

  try {
    // Título/autor do livro (apenas para metadados do resultado)
    let title = ""; let author = "";
    const { data: bookData } = await sb.from("books")
      .select("title, author, user_id").eq("id", book_id).maybeSingle();
    if (bookData && bookData.user_id === userId) {
      title = bookData.title; author = bookData.author || "";
    } else {
      const { data: pb } = await sb.from("premium_books")
        .select("title, author").eq("id", book_id).maybeSingle();
      if (pb) { title = pb.title; author = pb.author || ""; }
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    const ELEVEN_VOICE_MAP: Record<string, string> = {
      nova: "EXAVITQu4vr4xnSDxMaL",
      alloy: "9BWtsMINqrJLrRacOk9x",
      onyx: "JBFqnCBsd6RMkjVDRZzb",
      shimmer: "XB0fDUnXU5powFXDhCwa",
      echo: "iP95p4xoKVk53GoZ742B",
      fable: "TX3LPaxmHKxFdv7VOQHJ",
    };

    async function genTTS(text: string, voice: string): Promise<string> {
      const input = text.slice(0, 2500);
      if (OPENAI_API_KEY) {
        try {
          const r = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "tts-1", input, voice, response_format: "mp3" }),
          });
          if (r.ok) {
            const buf = await r.arrayBuffer();
            return `data:audio/mpeg;base64,${base64Encode(new Uint8Array(buf))}`;
          } else { console.error("openai tts", r.status); }
        } catch (e) { console.error("openai tts ex", e); }
      }
      if (ELEVENLABS_API_KEY) {
        try {
          const voiceId = ELEVEN_VOICE_MAP[voice] || ELEVEN_VOICE_MAP.nova;
          const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
            method: "POST",
            headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ text: input, model_id: "eleven_multilingual_v2" }),
          });
          if (r.ok) {
            const buf = await r.arrayBuffer();
            return `data:audio/mpeg;base64,${base64Encode(new Uint8Array(buf))}`;
          } else { console.error("eleven tts", r.status); }
        } catch (e) { console.error("eleven tts ex", e); }
      }
      return "";
    }

    // Carrega imagem do storage (bucket privado) -> data URL
    async function loadHighlightImage(storagePath: string): Promise<string> {
      try {
        const { data, error } = await sb.storage.from("highlight-images").download(storagePath);
        if (error || !data) { console.error("download img", storagePath, error?.message); return ""; }
        const buf = await data.arrayBuffer();
        const mime = data.type || "image/png";
        return `data:${mime};base64,${base64Encode(new Uint8Array(buf))}`;
      } catch (e) { console.error("loadHighlightImage ex", e); return ""; }
    }

    // Busca destaques do usuário neste livro que possuem imagem gerada
    const { data: hls, error: hlErr } = await sb
      .from("highlights")
      .select("id, text, page_number, created_at, highlight_images(storage_path, image_url)")
      .eq("user_id", userId)
      .eq("book_id", book_id)
      .order("page_number", { ascending: true });
    if (hlErr) throw new Error("Falha ao buscar destaques: " + hlErr.message);

    type HL = { id: string; text: string; page_number: number; img: { storage_path: string; image_url: string } | null };
    const withImg: HL[] = (hls || [])
      .map((h: any) => ({
        id: h.id,
        text: (h.text || "").trim(),
        page_number: h.page_number,
        img: Array.isArray(h.highlight_images) && h.highlight_images.length > 0 ? h.highlight_images[0] : null,
      }))
      .filter(h => h.text.length >= 4 && h.img);

    if (withImg.length === 0) {
      await markFailed("Nenhum destaque com imagem encontrado. Crie destaques no livro e gere imagens para eles antes de gerar o vídeo.");
      return new Response(JSON.stringify({ ok: false, reason: "no_highlights_with_images" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Vídeo final: 1min03s. ~5s por destaque -> ~12 destaques.
    const TARGET_TOTAL_SECONDS = 63;
    const SECONDS_PER_SCENE = 5;
    const maxScenes = Math.max(3, Math.min(14, Math.floor(TARGET_TOTAL_SECONDS / SECONDS_PER_SCENE)));
    const selected = withImg.slice(0, maxScenes);

    // Processa um destaque por vez (parte por parte) — baixa imagem + gera TTS.
    const built: any[] = [];
    for (let idx = 0; idx < selected.length; idx++) {
      const h = selected[idx];
      const imageDataUrl = await loadHighlightImage(h.img!.storage_path);
      const audioDataUrl = await genTTS(h.text, voice);
      built.push({
        chapterTitle: `Destaque ${idx + 1} · pág. ${h.page_number}`,
        narration: h.text,
        segments: [{ text: h.text, imageDataUrl }],
        audioDataUrl,
      });
    }

    const result = { title, author, scenes: built, targetDurationSeconds: TARGET_TOTAL_SECONDS };
    await sb.from("story_video_jobs").update({
      status: "completed",
      result,
      processed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(JSON.stringify({ ok: true, job_id: jobId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("generate-story-video worker error", msg);
    await markFailed(msg).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg, job_id: jobId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
