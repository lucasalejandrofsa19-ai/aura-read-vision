import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChapterScene {
  chapterTitle: string;
  narration: string;
  imagePrompts: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { book_id, mode = "summary", text: clientText, voice = "nova", scenesCount = 5 } = await req.json();
    if (!book_id) {
      return new Response(JSON.stringify({ error: "book_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check quota
    const { data: quota, error: quotaErr } = await supabaseClient.rpc("can_generate_story_video", { _user_id: user.id });
    if (quotaErr) console.error("quota error", quotaErr);
    if (quota && quota.allowed === false) {
      return new Response(JSON.stringify({
        error: "Limite mensal de vídeos atingido. Faça upgrade para Premium para vídeos ilimitados.",
        quota,
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch book
    let title = ""; let author = ""; let extractedText: string | null = null;
    const { data: bookData } = await supabaseClient.from("books")
      .select("title, author, extracted_text, user_id").eq("id", book_id).maybeSingle();
    if (bookData && bookData.user_id === user.id) {
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
      return new Response(JSON.stringify({ error: "Texto do livro não disponível. Abra o livro no leitor primeiro.", needsClientExtraction: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const MAX_CHARS = mode === "pages" ? 14000 : 70000;
    const truncated = extractedText.length > MAX_CHARS ? extractedText.slice(0, MAX_CHARS) : extractedText;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    // OPENAI/ELEVENLABS são opcionais — usamos fallback entre eles para imagens e TTS

    // Mapa de vozes OpenAI -> ElevenLabs (vozes públicas multilingual v2)
    const ELEVEN_VOICE_MAP: Record<string, string> = {
      nova: "EXAVITQu4vr4xnSDxMaL",   // Sarah
      alloy: "9BWtsMINqrJLrRacOk9x",  // Aria
      onyx: "JBFqnCBsd6RMkjVDRZzb",   // George
      shimmer: "XB0fDUnXU5powFXDhCwa",// Charlotte
      echo: "iP95p4xoKVk53GoZ742B",   // Chris
      fable: "TX3LPaxmHKxFdv7VOQHJ",  // Liam
    };

    // Helper: gera imagem via Lovable AI (Gemini), com fallback p/ OpenAI
    async function genImage(prompt: string, idx: number, pi: number): Promise<string> {
      const fullPrompt = prompt + " cinematic, painterly book illustration, consistent art style, no text, no words, no letters";
      // Primeiro: Gemini via Lovable AI Gateway (moderação mais permissiva)
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
          console.error("gemini image", idx, pi, r.status, await r.text());
        }
      } catch (e) { console.error("gemini image ex", idx, pi, e); }

      // Fallback OpenAI (se houver chave/quota)
      if (OPENAI_API_KEY) {
        try {
          const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "openai/gpt-image-2", prompt: fullPrompt, size: "1024x1024", quality: "low", n: 1 }),
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

    // Helper TTS: OpenAI -> ElevenLabs fallback
    async function genTTS(text: string, voice: string): Promise<string> {
      const input = text.slice(0, 1500);
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
          } else {
            console.error("openai tts", r.status);
          }
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
          } else {
            console.error("eleven tts", r.status, await r.text());
          }
        } catch (e) { console.error("eleven tts ex", e); }
      }
      return "";
    }

    const n = Math.max(3, Math.min(6, Number(scenesCount) || 5));
    const IMAGES_PER_SCENE = 3;

    const systemPrompt = `Você cria roteiros de vídeos narrados sobre livros, em português brasileiro, ESTRUTURADOS POR CAPÍTULOS.
Divida a obra em EXATAMENTE ${n} capítulos sequenciais que contem a história/ideia principal de forma envolvente e progressiva (início, desenvolvimento, clímax, desfecho).
Para CADA capítulo, produza:
- "chapterTitle": título curto e impactante do capítulo (3 a 6 palavras).
- "narration": 3 a 5 frases (60-110 palavras) prontas para narração em voz alta, fluidas e cinematográficas, conectando-se ao capítulo anterior. Sem markdown, sem emojis.
- "imagePrompts": array com EXATAMENTE ${IMAGES_PER_SCENE} descrições visuais EM INGLÊS, detalhadas e cinematográficas (estilo, iluminação, composição, ângulo), mostrando momentos DIFERENTES e SEQUENCIAIS dentro do mesmo capítulo, criando continuidade visual. Sem texto na imagem. Mantenha o MESMO estilo visual entre todas as imagens (mesma paleta, mesmo tratamento artístico) para coerência.

Responda APENAS com JSON válido: {"chapters":[{"chapterTitle":"...","narration":"...","imagePrompts":["...","...","..."]}]}`;

    const userPrompt = `Livro: "${title}"${author ? ` por ${author}` : ""}\nModo: ${mode === "pages" ? "trecho selecionado" : "obra completa"}\n\nConteúdo:\n${truncated}`;

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
    let parsed: { chapters: ChapterScene[] };
    try {
      parsed = JSON.parse(scriptData.choices[0].message.content);
    } catch (e) {
      console.error("json parse error", e, scriptData.choices?.[0]?.message?.content);
      throw new Error("Roteiro inválido retornado pela IA");
    }
    const chapters = (parsed.chapters || []).slice(0, n).filter(c => c.narration && Array.isArray(c.imagePrompts) && c.imagePrompts.length > 0);
    if (chapters.length === 0) throw new Error("Nenhum capítulo gerado");

    // Generate images for each chapter (parallel across all prompts) + TTS per chapter
    const built = await Promise.all(chapters.map(async (ch, idx) => {
      const prompts = ch.imagePrompts.slice(0, IMAGES_PER_SCENE);
      const imageDataUrls = await Promise.all(prompts.map((p, pi) => genImage(p, idx, pi)));
      const audioDataUrl = await genTTS(ch.narration, voice);
      return {
        chapterTitle: ch.chapterTitle || `Capítulo ${idx + 1}`,
        narration: ch.narration,
        imageDataUrls: imageDataUrls.filter(Boolean),
        audioDataUrl,
      };
    }));

    // Build outro scene (app promo)
    const outroNarration = `Você acabou de assistir a uma história criada com a inteligência artificial do AURA READ. Transforme seus livros em vídeos, áudios e resumos inteligentes. Acesse auraread.store e comece grátis agora mesmo.`;
    const outroAudio = await genTTS(outroNarration, voice);


    const outro = {
      chapterTitle: "AURA READ",
      narration: outroNarration,
      imageDataUrls: [], // client renders branded promo card
      audioDataUrl: outroAudio,
      isOutro: true as const,
    };

    // Record generation
    await supabaseClient.from("story_videos").insert({
      user_id: user.id,
      book_id,
      book_title: title,
      mode,
      scenes_count: built.length,
    });

    const { data: newQuota } = await supabaseClient.rpc("can_generate_story_video", { _user_id: user.id });

    return new Response(JSON.stringify({ title, author, scenes: [...built, outro], quota: newQuota }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-story-video error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
