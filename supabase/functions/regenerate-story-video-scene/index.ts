// Regenera áudio + imagem de UMA cena específica usando o texto editado.
// Síncrono (retorna data URLs). Não toca em story_video_jobs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELEVEN_VOICE_MAP: Record<string, string> = {
  nova: "EXAVITQu4vr4xnSDxMaL",
  alloy: "9BWtsMINqrJLrRacOk9x",
  onyx: "JBFqnCBsd6RMkjVDRZzb",
  shimmer: "XB0fDUnXU5powFXDhCwa",
  echo: "iP95p4xoKVk53GoZ742B",
  fable: "TX3LPaxmHKxFdv7VOQHJ",
};
const TONE_TO_ELEVEN: Record<string, { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean }> = {
  neutro:    { stability: 0.55, similarity_boost: 0.75, style: 0.20, use_speaker_boost: true },
  alegre:    { stability: 0.35, similarity_boost: 0.75, style: 0.65, use_speaker_boost: true },
  serio:     { stability: 0.80, similarity_boost: 0.80, style: 0.10, use_speaker_boost: true },
  empolgado: { stability: 0.25, similarity_boost: 0.70, style: 0.80, use_speaker_boost: true },
  dramatico: { stability: 0.30, similarity_boost: 0.75, style: 0.75, use_speaker_boost: true },
  calmo:     { stability: 0.85, similarity_boost: 0.70, style: 0.15, use_speaker_boost: true },
};
const TONE_TO_OPENAI_SPEED: Record<string, number> = {
  neutro: 1.0, alegre: 1.05, serio: 0.95, empolgado: 1.1, dramatico: 0.9, calmo: 0.9,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const narration = String(body.narration ?? "").trim();
    if (narration.length < 2) {
      return new Response(JSON.stringify({ error: "Texto de narração obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const voice = (body.voice as string) || "nova";
    const tone = ((body.tone as string) || "neutro").toLowerCase();
    const chapterTitle = String(body.chapterTitle ?? "").slice(0, 200);
    const imagePromptIn = body.imagePrompt ? String(body.imagePrompt).slice(0, 500) : "";
    const highlightId = body.highlightId ? String(body.highlightId).slice(0, 64) : "";
    const mode = (body.mode as string) || "summary";

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const toneCfg = TONE_TO_ELEVEN[tone] || TONE_TO_ELEVEN.neutro;
    const preferEleven = tone !== "neutro" && !!ELEVENLABS_API_KEY;

    async function ttsOpenAI(): Promise<string> {
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "tts-1", input: narration.slice(0, 2500), voice, response_format: "mp3", speed: TONE_TO_OPENAI_SPEED[tone] ?? 1.0 }),
      });
      if (!r.ok) { console.error("openai tts", r.status); return ""; }
      const buf = await r.arrayBuffer();
      return `data:audio/mpeg;base64,${base64Encode(new Uint8Array(buf))}`;
    }
    async function ttsEleven(): Promise<string> {
      const voiceId = ELEVEN_VOICE_MAP[voice] || ELEVEN_VOICE_MAP.nova;
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ text: narration.slice(0, 2500), model_id: "eleven_multilingual_v2", voice_settings: toneCfg }),
      });
      if (!r.ok) { console.error("eleven tts", r.status); return ""; }
      const buf = await r.arrayBuffer();
      return `data:audio/mpeg;base64,${base64Encode(new Uint8Array(buf))}`;
    }
    async function genTTS(): Promise<string> {
      try {
        if (preferEleven) {
          const a = await ttsEleven(); if (a) return a;
          if (OPENAI_API_KEY) return await ttsOpenAI();
        } else {
          if (OPENAI_API_KEY) { const a = await ttsOpenAI(); if (a) return a; }
          if (ELEVENLABS_API_KEY) return await ttsEleven();
        }
      } catch (e) { console.error("tts ex", e); }
      return "";
    }

    async function loadHighlightImage(): Promise<string> {
      if (!highlightId) return "";
      const { data: hi } = await sb.from("highlight_images")
        .select("storage_path, highlights!inner(user_id)")
        .eq("highlight_id", highlightId)
        .maybeSingle();
      const path = (hi as any)?.storage_path;
      const owner = (hi as any)?.highlights?.user_id;
      if (!path || owner !== user.id) return "";
      const { data, error } = await sb.storage.from("highlight-images").download(path);
      if (error || !data) return "";
      const buf = await data.arrayBuffer();
      return `data:${data.type || "image/png"};base64,${base64Encode(new Uint8Array(buf))}`;
    }

    async function genImage(prompt: string): Promise<string> {
      const full = `${prompt}. Vertical 9:16 portrait, cinematic painterly book illustration, consistent art style, no text, no letters, no UI`;
      if (LOVABLE_API_KEY) {
        try {
          const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content: full }],
              modalities: ["image", "text"],
            }),
          });
          if (r.ok) {
            const j = await r.json();
            const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (url) return url;
          } else { console.error("gemini image", r.status); }
        } catch (e) { console.error("gemini image ex", e); }
      }
      if (OPENAI_API_KEY && LOVABLE_API_KEY) {
        try {
          const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "openai/gpt-image-2", prompt: full, size: "1024x1536", quality: "low", n: 1 }),
          });
          if (r.ok) {
            const j = await r.json();
            const b64 = j?.data?.[0]?.b64_json;
            if (b64) return `data:image/png;base64,${b64}`;
          }
        } catch (e) { console.error("openai image ex", e); }
      }
      return "";
    }

    // Mode highlights: reaproveita imagem do destaque do usuário; senão gera por IA.
    const imagePromise = mode === "highlights" && highlightId
      ? loadHighlightImage().then(img => img || genImage(imagePromptIn || chapterTitle || narration.slice(0, 80)))
      : genImage(imagePromptIn || chapterTitle || narration.slice(0, 80));

    const [audioDataUrl, imageDataUrl] = await Promise.all([genTTS(), imagePromise]);
    if (!audioDataUrl && !imageDataUrl) {
      return new Response(JSON.stringify({ error: "Falha ao regenerar áudio e imagem" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      chapterTitle: chapterTitle || `Cena`,
      narration,
      audioDataUrl,
      segments: [{ text: narration, imageDataUrl }],
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("regenerate-story-video-scene error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
