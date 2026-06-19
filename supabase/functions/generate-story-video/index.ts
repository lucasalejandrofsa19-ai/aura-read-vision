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

  // Worker auth: only the cron job (and admin debugging with the secret) may run this.
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const providedSecret = req.headers.get("x-internal-secret");
  if (!internalSecret || providedSecret !== internalSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Atomically claim the next pending job.
  const { data: job, error: claimErr } = await supabaseClient.rpc("claim_next_story_video_job");
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
    await supabaseClient.from("story_video_jobs").update({
      status: "failed",
      error: msg,
      processed_at: new Date().toISOString(),
    }).eq("id", jobId);
  };

  try {
    // Fetch book
    let title = ""; let author = ""; let extractedText: string | null = null;
    const { data: bookData } = await supabaseClient.from("books")
      .select("title, author, extracted_text, user_id").eq("id", book_id).maybeSingle();
    if (bookData && bookData.user_id === userId) {
      title = bookData.title; author = bookData.author || ""; extractedText = bookData.extracted_text;
    } else {
      const { data: pb } = await supabaseClient.from("premium_books")
        .select("title, author, extracted_text").eq("id", book_id).maybeSingle();
      if (pb) { title = pb.title; author = pb.author || ""; extractedText = pb.extracted_text; }
    }
    if ((!extractedText || extractedText.trim().length < 100) && typeof clientText === "string" && clientText.trim().length >= 50) {
      extractedText = clientText;
    }
    if (!extractedText || extractedText.trim().length < 50) {
      await markFailed("Texto do livro não disponível.");
      return new Response(JSON.stringify({ ok: false, reason: "no_text" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const MAX_CHARS = mode === "pages" ? 14000 : 70000;
    const truncated = extractedText.length > MAX_CHARS ? extractedText.slice(0, MAX_CHARS) : extractedText;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");


    const ELEVEN_VOICE_MAP: Record<string, string> = {
      nova: "EXAVITQu4vr4xnSDxMaL",
      alloy: "9BWtsMINqrJLrRacOk9x",
      onyx: "JBFqnCBsd6RMkjVDRZzb",
      shimmer: "XB0fDUnXU5powFXDhCwa",
      echo: "iP95p4xoKVk53GoZ742B",
      fable: "TX3LPaxmHKxFdv7VOQHJ",
    };

    // Helper: gera imagem PORTRAIT 9:16 via Gemini -> OpenAI fallback
    async function genImage(prompt: string, idx: number, pi: number): Promise<string> {
      const fullPrompt = `${prompt}. Vertical 9:16 portrait composition, full-bleed cinematic frame, painterly book illustration, consistent art style, no text, no words, no letters, no captions, no UI`;
      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: fullPrompt }],
            modalities: ["image", "text"],
          }),
        });
        if (r.ok) {
          const j = await r.json();
          const imgs = j?.choices?.[0]?.message?.images;
          const url = imgs?.[0]?.image_url?.url;
          if (url) return url;
        } else {
          console.error("gemini image", idx, pi, r.status);
        }
      } catch (e) { console.error("gemini image ex", idx, pi, e); }

      if (OPENAI_API_KEY) {
        try {
          const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "openai/gpt-image-2", prompt: fullPrompt, size: "1024x1536", quality: "low", n: 1 }),
          });
          if (r.ok) {
            const j = await r.json();
            const b64 = j?.data?.[0]?.b64_json;
            if (b64) return `data:image/png;base64,${b64}`;
          } else {
            console.error("openai image fallback", idx, pi, r.status);
          }
        } catch (e) { console.error("openai image ex", idx, pi, e); }
      }
      return "";
    }

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

    const n = Math.max(3, Math.min(5, Number(scenesCount) || 4));
    // O vídeo FINAL deve ter cerca de 1min30 no total, não 1min30 por capítulo.
    // Poucos segmentos mantêm a narração curta, reduzem créditos e evitam limite de memória.
    const TARGET_TOTAL_SECONDS = 90;
    const SEGMENTS_PER_SCENE = n <= 3 ? 4 : 3;
    const TARGET_WORDS_TOTAL = 190;
    const TARGET_WORDS_PER_SEGMENT = Math.max(7, Math.floor(TARGET_WORDS_TOTAL / (n * SEGMENTS_PER_SCENE)));
    const seed = variationSeed ?? Math.floor(Math.random() * 1e9);

    const systemPrompt = `Você cria roteiros de vídeos verticais (9:16, Reels/TikTok) narrados sobre livros em português brasileiro, ESTRUTURADOS POR CAPÍTULOS.
Divida a obra em EXATAMENTE ${n} capítulos sequenciais (início, desenvolvimento, clímax, desfecho).
O vídeo FINAL inteiro terá aproximadamente ${TARGET_TOTAL_SECONDS} segundos. NÃO crie 90 segundos por capítulo.
Para CADA capítulo, produza:
- "chapterTitle": título curto (3-6 palavras).
- "segments": EXATAMENTE ${SEGMENTS_PER_SCENE} segmentos. Cada um:
  - "text": UMA FRASE PT-BR curta (${TARGET_WORDS_PER_SEGMENT}-${TARGET_WORDS_PER_SEGMENT + 3} palavras), cinematográfica, fluida, sem emojis/markdown.
  - "imagePrompt": descrição visual EM INGLÊS (máx 20 palavras), cinematográfica, vertical 9:16, paleta consistente, sem texto.
O roteiro completo deve ter cerca de ${TARGET_WORDS_TOTAL} palavras no total, para a narração caber em 1 minuto e meio.
Use ângulos visuais variados (close, wide, detail, action) para imagens distintas.

IMPORTANTE: Responda APENAS JSON válido COMPLETO (não trunque): {"chapters":[{"chapterTitle":"...","segments":[{"text":"...","imagePrompt":"..."}]}]}`;

    const userPrompt = `Livro: "${title}"${author ? ` por ${author}` : ""}\nModo: ${mode === "pages" ? "trecho selecionado" : "obra completa"}\nSeed de variação: ${seed} (use para variar tom, foco narrativo e estilo visual a cada geração).\n\nConteúdo:\n${truncated}`;

    const scriptRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 16000,
        temperature: 0.9,
      }),
    });
    if (!scriptRes.ok) {
      const t = await scriptRes.text();
      console.error("script error", scriptRes.status, t);
      if (scriptRes.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (scriptRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Falha ao gerar roteiro");
    }
    const scriptData = await scriptRes.json();
    const rawContent: string = scriptData.choices?.[0]?.message?.content ?? "";
    let parsed: { chapters: ChapterScene[] };
    const tryParse = (s: string) => JSON.parse(s);
    const extractJson = (s: string) => {
      const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = fenced ? fenced[1] : s;
      const start = candidate.indexOf("{");
      const end = candidate.lastIndexOf("}");
      return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
    };
    try {
      parsed = tryParse(rawContent);
    } catch {
      try {
        parsed = tryParse(extractJson(rawContent));
      } catch {
        try {
          const { jsonrepair } = await import("https://esm.sh/jsonrepair@3.8.0");
          parsed = tryParse(jsonrepair(extractJson(rawContent)));
        } catch {
          // Salvage: truncar até o último segmento completo
          try {
            const txt = rawContent;
            // pega só capítulos/segmentos completos via regex
            const segRe = /\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"imagePrompt"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
            const chapRe = /"chapterTitle"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
            const titles: string[] = [];
            let m: RegExpExecArray | null;
            while ((m = chapRe.exec(txt)) !== null) titles.push(m[1]);
            const allSegs: { text: string; imagePrompt: string }[] = [];
            while ((m = segRe.exec(txt)) !== null) allSegs.push({ text: m[1], imagePrompt: m[2] });
            if (titles.length === 0 || allSegs.length === 0) throw new Error("no salvage");
            const perChap = Math.max(1, Math.floor(allSegs.length / titles.length));
            const chaptersSalvaged = titles.map((t, i) => ({
              chapterTitle: t,
              segments: allSegs.slice(i * perChap, (i + 1) * perChap),
            })).filter(c => c.segments.length > 0);
            if (chaptersSalvaged.length === 0) throw new Error("no salvage");
            parsed = { chapters: chaptersSalvaged };
          } catch (e) {
            console.error("json parse error after repair", e, rawContent.slice(0, 500));
            throw new Error("Roteiro inválido retornado pela IA");
          }
        }
      }
    }
    const chapters = (parsed.chapters || []).slice(0, n).filter(c =>
      Array.isArray(c.segments) && c.segments.length > 0 && c.segments.every(s => s.text && s.imagePrompt)
    );
    if (chapters.length === 0) throw new Error("Nenhum capítulo gerado");

    // Processa capítulos SEQUENCIALMENTE para evitar pico de memória (WORKER_RESOURCE_LIMIT)
    const built: any[] = [];
    for (let idx = 0; idx < chapters.length; idx++) {
      const ch = chapters[idx];
      const segs = ch.segments.slice(0, SEGMENTS_PER_SCENE);
      // imagens do capítulo em paralelo (só um capítulo por vez na memória)
      const imgs = await Promise.all(segs.map((s, pi) => genImage(s.imagePrompt, idx, pi)));
      const fullNarration = segs.map(s => s.text.trim()).join(" ");
      const audioDataUrl = await genTTS(fullNarration, voice);
      const segments = segs.map((s, pi) => ({ text: s.text, imageDataUrl: imgs[pi] || "" }));
      built.push({
        chapterTitle: ch.chapterTitle || `Capítulo ${idx + 1}`,
        narration: fullNarration,
        segments,
        audioDataUrl,
      });
    }

    const result = { title, author, scenes: built, targetDurationSeconds: TARGET_TOTAL_SECONDS };
    await supabaseClient.from("story_video_jobs").update({
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
