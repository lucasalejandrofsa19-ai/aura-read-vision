// 1.5 fix: worker mode. Invoked by pg_cron every 30s (or directly for debug).
// Auth: requires `x-internal-secret` header matching INTERNAL_FUNCTION_SECRET.
// Pulls 1 pending job atomically via claim_next_story_video_job(), processes,
// writes result/error back to story_video_jobs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { captureEdgeError } from "../_shared/sentry.ts";
import { chatCompletion, generateImage } from "../_shared/ai-providers.ts";

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
  // Use a single service-role client (public schema). Read the worker token via
  // public.get_cron_token RPC so we don't need PostgREST to expose `private`.
  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const { data: expectedToken, error: tokenErr } = await sb.rpc("get_cron_token", { _name: "story_video_worker" });
  if (tokenErr || !expectedToken || providedSecret !== String(expectedToken)) {
    console.error("worker auth failed", { tokenErr, hasToken: !!expectedToken });
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
  const tone = ((params.tone as string) || "neutro").toLowerCase();
  const scenesCount = Number(params.scenesCount) || 5;
  const variationSeed = params.variationSeed as number | null | undefined;
  const scenesOverride = Array.isArray(params.scenesOverride)
    ? (params.scenesOverride as Array<{ chapterTitle?: string; narration: string; imagePrompt?: string; highlightId?: string }>)
    : null;

  const markFailed = async (msg: string) => {
    await sb.from("story_video_jobs").update({
      status: "failed",
      error: msg,
      processed_at: new Date().toISOString(),
    }).eq("id", jobId);
  };

  const SECONDS_PER_STEP = 7;
  const updateProgress = async (p: Record<string, unknown>) => {
    try { await sb.from("story_video_jobs").update({ progress: p }).eq("id", jobId); }
    catch (e) { console.error("progress update", e); }
  };
  const shouldContinue = async (): Promise<boolean> => {
    const { data } = await sb.from("story_video_jobs").select("status").eq("id", jobId).maybeSingle();
    return data?.status === "processing";
  };

  // Persist the finished result so BookVideoHistory can list/download it.
  const estimateSec = (txt: string) => Math.max(2, Math.round(((txt || "").split(/\s+/).filter(Boolean).length / 150) * 60));
  const persistVideo = async (
    result: { title: string; author: string; scenes: Array<{ chapterTitle: string; narration: string; segments?: Array<{ imageDataUrl?: string }>; audioDataUrl?: string }> },
    runMode: string,
  ) => {
    try {
      let cursor = 0;
      const scenesMeta = result.scenes.map((s, i) => {
        const duration = estimateSec(s.narration);
        const startSec = cursor;
        cursor += duration;
        return {
          index: i,
          title: s.chapterTitle,
          narration: s.narration,
          wordCount: (s.narration || "").split(/\s+/).filter(Boolean).length,
          startSec,
          endSec: cursor,
          durationSec: duration,
          imageCount: (s.segments || []).filter(g => g.imageDataUrl).length,
          hasAudio: !!s.audioDataUrl,
        };
      });
      const payload = {
        version: 1,
        kind: "story-video-script",
        title: result.title,
        author: result.author,
        mode: runMode,
        voice, tone,
        generatedAt: new Date().toISOString(),
        totalDurationSec: cursor,
        scenes: scenesMeta,
      };
      const body = new TextEncoder().encode(JSON.stringify(payload, null, 2));
      const path = `${userId}/${jobId}.json`;
      const up = await sb.storage.from("story-videos")
        .upload(path, body, { contentType: "application/json", upsert: true });
      if (up.error) { console.error("persist upload", up.error); return; }
      await sb.from("story_videos").insert({
        user_id: userId,
        book_id,
        book_title: result.title,
        mode: runMode,
        scenes_count: result.scenes.length,
        file_path: path,
        file_size: body.byteLength,
        file_mime: "application/json",
        status: "ok",
      });
    } catch (e) { console.error("persistVideo failed", e); }
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

    // Mapeia tom -> ajustes prosódicos (ElevenLabs) e velocidade (OpenAI)
    const TONE_TO_ELEVEN: Record<string, { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean }> = {
      neutro:     { stability: 0.55, similarity_boost: 0.75, style: 0.20, use_speaker_boost: true },
      alegre:     { stability: 0.35, similarity_boost: 0.75, style: 0.65, use_speaker_boost: true },
      serio:      { stability: 0.80, similarity_boost: 0.80, style: 0.10, use_speaker_boost: true },
      empolgado:  { stability: 0.25, similarity_boost: 0.70, style: 0.80, use_speaker_boost: true },
      dramatico:  { stability: 0.30, similarity_boost: 0.75, style: 0.75, use_speaker_boost: true },
      calmo:      { stability: 0.85, similarity_boost: 0.70, style: 0.15, use_speaker_boost: true },
    };
    const TONE_TO_OPENAI_SPEED: Record<string, number> = {
      neutro: 1.0, alegre: 1.05, serio: 0.95, empolgado: 1.1, dramatico: 0.9, calmo: 0.9,
    };
    const toneCfg = TONE_TO_ELEVEN[tone] || TONE_TO_ELEVEN.neutro;
    const preferEleven = tone !== "neutro" && !!ELEVENLABS_API_KEY;

    async function ttsOpenAI(input: string, voice: string): Promise<string> {
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "tts-1", input, voice, response_format: "mp3", speed: TONE_TO_OPENAI_SPEED[tone] ?? 1.0 }),
      });
      if (!r.ok) { console.error("openai tts", r.status); return ""; }
      const buf = await r.arrayBuffer();
      return `data:audio/mpeg;base64,${base64Encode(buf)}`;
    }
    async function ttsEleven(input: string, voice: string): Promise<string> {
      const voiceId = ELEVEN_VOICE_MAP[voice] || ELEVEN_VOICE_MAP.nova;
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, model_id: "eleven_multilingual_v2", voice_settings: toneCfg }),
      });
      if (!r.ok) { console.error("eleven tts", r.status); return ""; }
      const buf = await r.arrayBuffer();
      return `data:audio/mpeg;base64,${base64Encode(buf)}`;
    }
    async function genTTS(text: string, voice: string): Promise<string> {
      const input = text.slice(0, 2500);
      try {
        if (preferEleven) {
          const a = await ttsEleven(input, voice); if (a) return a;
          if (OPENAI_API_KEY) return await ttsOpenAI(input, voice);
        } else {
          if (OPENAI_API_KEY) { const a = await ttsOpenAI(input, voice); if (a) return a; }
          if (ELEVENLABS_API_KEY) return await ttsEleven(input, voice);
        }
      } catch (e) { console.error("tts ex", e); }
      return "";
    }

    // Carrega imagem do storage (bucket privado) -> data URL
    async function loadHighlightImage(storagePath: string): Promise<string> {
      try {
        const { data, error } = await sb.storage.from("highlight-images").download(storagePath);
        if (error || !data) { console.error("download img", storagePath, error?.message); return ""; }
        const buf = await data.arrayBuffer();
        const mime = data.type || "image/png";
        return `data:${mime};base64,${base64Encode(buf)}`;
      } catch (e) { console.error("loadHighlightImage ex", e); return ""; }
    }

    // Geração de imagem via Lovable AI (Gemini image) com fallback OpenAI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    async function genImage(prompt: string): Promise<string> {
      const full = `${prompt}. Vertical 9:16 portrait, cinematic painterly book illustration, consistent art style, no text, no letters, no UI`;
      if (LOVABLE_API_KEY) {
        try {
          const r = chatCompletion({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content: full }],
              modalities: ["image", "text"],
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

    const TARGET_TOTAL_SECONDS = 63;
    const SECONDS_PER_SCENE = 5;
    const maxScenes = Math.max(3, Math.min(14, Math.floor(TARGET_TOTAL_SECONDS / SECONDS_PER_SCENE)));

    // === Modo HIGHLIGHTS: usa destaques+imagens do usuário ===
    if (mode === "highlights") {
      const { data: hls, error: hlErr } = await sb
        .from("highlights")
        .select("id, text, page_number, created_at, highlight_images(storage_path, image_url)")
        .eq("user_id", userId)
        .eq("book_id", book_id)
        .order("page_number", { ascending: true });
      if (hlErr) throw new Error("Falha ao buscar destaques: " + hlErr.message);
      type HL = { id: string; text: string; page_number: number; img: { storage_path: string; image_url: string } | null };
      const withImg: HL[] = (hls || [])
        .map((h: any) => ({ id: h.id, text: (h.text || "").trim(), page_number: h.page_number,
          img: Array.isArray(h.highlight_images) && h.highlight_images.length > 0 ? h.highlight_images[0] : null }))
        .filter(h => h.text.length >= 4 && h.img);
      if (withImg.length === 0) {
        await markFailed("Nenhum destaque com imagem encontrado. Crie destaques e gere imagens antes de gerar o vídeo.");
        return new Response(JSON.stringify({ ok: false, reason: "no_highlights_with_images" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // If user provided an edited script, restrict/reorder to matching highlightIds
      // and use their edited narration text. Otherwise fall back to raw highlight text.
      let pipeline: Array<{ id: string; text: string; page_number: number; img: { storage_path: string; image_url: string } | null; title?: string }> = [];
      if (scenesOverride && scenesOverride.length > 0) {
        const byId = new Map(withImg.map(h => [h.id, h] as const));
        for (const s of scenesOverride) {
          if (!s.highlightId) continue;
          const h = byId.get(s.highlightId);
          if (!h) continue;
          pipeline.push({ ...h, text: (s.narration || h.text).trim(), title: s.chapterTitle });
        }
      }
      if (pipeline.length === 0) pipeline = withImg.slice(0, maxScenes).map(h => ({ ...h }));
      const selected = pipeline.slice(0, maxScenes);
      const total = selected.length;
      await updateProgress({ current: 0, total, stage: "starting", etaSeconds: total * SECONDS_PER_STEP, sceneTitle: null });
      const built: any[] = [];
      for (let idx = 0; idx < selected.length; idx++) {
        if (!(await shouldContinue())) return new Response(JSON.stringify({ ok: false, cancelled: true, job_id: jobId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const h = selected[idx];
        const sceneTitle = h.title || `Destaque ${idx + 1} · pág. ${h.page_number}`;
        const remainingAfter = (total - idx - 1) * SECONDS_PER_STEP;
        await updateProgress({ current: idx + 1, total, stage: "image", sceneTitle, etaSeconds: remainingAfter + SECONDS_PER_STEP });
        const imageDataUrl = await loadHighlightImage(h.img!.storage_path);
        await updateProgress({ current: idx + 1, total, stage: "narration", sceneTitle, etaSeconds: remainingAfter + Math.ceil(SECONDS_PER_STEP / 2) });
        const audioDataUrl = await genTTS(h.text, voice);
        built.push({ chapterTitle: sceneTitle, narration: h.text, segments: [{ text: h.text, imageDataUrl }], audioDataUrl });
        await updateProgress({ current: idx + 1, total, stage: "scene_done", sceneTitle, etaSeconds: remainingAfter });
      }
      await updateProgress({ current: total, total, stage: "finalizing", sceneTitle: null, etaSeconds: 0 });
      if (!(await shouldContinue())) return new Response(JSON.stringify({ ok: false, cancelled: true, job_id: jobId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const result = { title, author, scenes: built, targetDurationSeconds: TARGET_TOTAL_SECONDS };
      await sb.from("story_video_jobs").update({ status: "completed", result, processed_at: new Date().toISOString(),
        progress: { current: total, total, stage: "completed", sceneTitle: null, etaSeconds: 0 } }).eq("id", jobId);
      await persistVideo(result, "highlights");
      return new Response(JSON.stringify({ ok: true, job_id: jobId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Modo AI (default): analisa o livro e gera mini-histórias com imagens + narração ===
    let chapters: { chapterTitle: string; narration: string; imagePrompt: string }[];
    let n: number;

    if (scenesOverride && scenesOverride.length > 0) {
      // Usa o roteiro editado pelo usuário. Preserva narration e título;
      // se faltar imagePrompt, sintetiza um a partir do título.
      chapters = scenesOverride.slice(0, maxScenes).map((s, i) => ({
        chapterTitle: (s.chapterTitle || `Cena ${i + 1}`).slice(0, 200),
        narration: s.narration.trim(),
        imagePrompt: (s.imagePrompt || `${s.chapterTitle || "book scene"}, cinematic illustration`).slice(0, 500),
      })).filter(c => c.narration.length >= 2);
      if (chapters.length === 0) throw new Error("Roteiro editado inválido");
      n = chapters.length;
      await updateProgress({ current: 0, total: n, stage: "starting", etaSeconds: (n + 1) * SECONDS_PER_STEP, sceneTitle: "Usando roteiro editado" });
    } else {
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
      let extractedText: string | null = null;
      const { data: bk2 } = await sb.from("books").select("extracted_text, user_id").eq("id", book_id).maybeSingle();
      if (bk2 && bk2.user_id === userId) extractedText = bk2.extracted_text;
      if (!extractedText) {
        const { data: pb2 } = await sb.from("premium_books").select("extracted_text").eq("id", book_id).maybeSingle();
        if (pb2) extractedText = pb2.extracted_text;
      }
      if ((!extractedText || extractedText.trim().length < 100) && typeof clientText === "string" && clientText.trim().length >= 50) {
        extractedText = clientText;
      }
      if (!extractedText || extractedText.trim().length < 50) {
        await markFailed("Texto do livro não disponível para análise.");
        return new Response(JSON.stringify({ ok: false, reason: "no_text" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const truncated = extractedText.length > 50000 ? extractedText.slice(0, 50000) : extractedText;
      n = Math.max(3, Math.min(maxScenes, Number(scenesCount) || 8));
      const wordsPerScene = Math.max(10, Math.floor(190 / n));
      const seed = variationSeed ?? Math.floor(Math.random() * 1e9);

      await updateProgress({ current: 0, total: n, stage: "starting", etaSeconds: (n + 1) * SECONDS_PER_STEP, sceneTitle: "Analisando o livro" });

      const sysPrompt = `Você cria roteiros de vídeos verticais 9:16 narrados sobre livros, em PT-BR.
Analise o livro e identifique trama, personagens, cenários e temas. Divida em EXATAMENTE ${n} mini-histórias coesas (início, desenvolvimento, clímax, desfecho).
Para CADA mini-história produza:
- "chapterTitle": 3-6 palavras
- "narration": UMA frase fluida (${wordsPerScene}-${wordsPerScene + 4} palavras), envolvente, sem emojis/markdown
- "imagePrompt": descrição visual em INGLÊS (máx 20 palavras), cinematográfica, vertical 9:16, paleta consistente, sem texto
Total do vídeo ~${TARGET_TOTAL_SECONDS}s. Responda APENAS JSON: {"chapters":[{"chapterTitle":"...","narration":"...","imagePrompt":"..."}]}`;
      const userPrompt = `Livro: "${title}"${author ? ` por ${author}` : ""}\nSeed: ${seed}\n\nConteúdo:\n${truncated}`;

      const scriptRes = chatCompletion({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
          response_format: { type: "json_object" },
          max_tokens: 8000,
          temperature: 0.9,
        });
      if (!scriptRes.ok) {
        const t = await scriptRes.text();
        console.error("script error", scriptRes.status, t);
        throw new Error(scriptRes.status === 402 ? "Créditos de IA esgotados." : "Falha ao gerar roteiro");
      }
      const scriptData = await scriptRes.json();
      const raw: string = scriptData.choices?.[0]?.message?.content ?? "";
      let parsed: { chapters: { chapterTitle: string; narration: string; imagePrompt: string }[] };
      try { parsed = JSON.parse(raw); }
      catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("Roteiro inválido retornado pela IA");
        parsed = JSON.parse(m[0]);
      }
      chapters = (parsed.chapters || []).slice(0, n)
        .filter(c => c.narration && c.imagePrompt);
      if (chapters.length === 0) throw new Error("Nenhuma mini-história gerada");
    }


    const total = chapters.length;
    const built: any[] = [];
    for (let idx = 0; idx < chapters.length; idx++) {
      if (!(await shouldContinue())) return new Response(JSON.stringify({ ok: false, cancelled: true, job_id: jobId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const c = chapters[idx];
      const sceneTitle = c.chapterTitle || `Cena ${idx + 1}`;
      const remainingAfter = (total - idx - 1) * SECONDS_PER_STEP;
      await updateProgress({ current: idx + 1, total, stage: "image", sceneTitle, etaSeconds: remainingAfter + SECONDS_PER_STEP });
      const imageDataUrl = await genImage(c.imagePrompt);
      await updateProgress({ current: idx + 1, total, stage: "narration", sceneTitle, etaSeconds: remainingAfter + Math.ceil(SECONDS_PER_STEP / 2) });
      const audioDataUrl = await genTTS(c.narration, voice);
      built.push({ chapterTitle: sceneTitle, narration: c.narration, segments: [{ text: c.narration, imageDataUrl }], audioDataUrl });
      await updateProgress({ current: idx + 1, total, stage: "scene_done", sceneTitle, etaSeconds: remainingAfter });
    }

    await updateProgress({ current: total, total, stage: "finalizing", sceneTitle: null, etaSeconds: 0 });
    if (!(await shouldContinue())) return new Response(JSON.stringify({ ok: false, cancelled: true, job_id: jobId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const result = { title, author, scenes: built, targetDurationSeconds: TARGET_TOTAL_SECONDS };
    await sb.from("story_video_jobs").update({
      status: "completed",
      result,
      processed_at: new Date().toISOString(),
      progress: { current: total, total, stage: "completed", sceneTitle: null, etaSeconds: 0 },
    }).eq("id", jobId);
    await persistVideo(result, mode);

    return new Response(JSON.stringify({ ok: true, job_id: jobId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    captureEdgeError(error, { function: "generate-story-video" });
    const msg = error instanceof Error ? error.message : String(error);
    console.error("generate-story-video worker error", msg);
    await markFailed(msg).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg, job_id: jobId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
