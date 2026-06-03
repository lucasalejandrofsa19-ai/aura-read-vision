import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Scene { narration: string; imagePrompt: string }

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

    const MAX_CHARS = mode === "pages" ? 12000 : 60000;
    const truncated = extractedText.length > MAX_CHARS ? extractedText.slice(0, MAX_CHARS) : extractedText;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const n = Math.max(3, Math.min(6, Number(scenesCount) || 5));
    const systemPrompt = `Você cria roteiros de vídeos curtos narrados sobre livros, em português brasileiro.
Receba o conteúdo do livro e produza EXATAMENTE ${n} cenas que contem a história/ideia principal de forma envolvente.
Cada cena deve ter:
- "narration": 2 a 4 frases (35-70 palavras) prontas para serem narradas em voz alta, fluidas e cinematográficas. Sem markdown, sem emojis.
- "imagePrompt": descrição visual EM INGLÊS, detalhada, cinematográfica (estilo, iluminação, composição) para gerar uma ilustração que represente a cena. Sem texto na imagem.

Responda APENAS com JSON válido no formato: {"scenes":[{"narration":"...","imagePrompt":"..."}]}`;

    const userPrompt = `Livro: "${title}"${author ? ` por ${author}` : ""}\nModo: ${mode === "pages" ? "trecho selecionado" : "resumo geral"}\n\nConteúdo:\n${truncated}`;

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
    let parsed: { scenes: Scene[] };
    try {
      parsed = JSON.parse(scriptData.choices[0].message.content);
    } catch (e) {
      console.error("json parse error", e, scriptData.choices?.[0]?.message?.content);
      throw new Error("Roteiro inválido retornado pela IA");
    }
    const scenes = (parsed.scenes || []).slice(0, n).filter(s => s.narration && s.imagePrompt);
    if (scenes.length === 0) throw new Error("Nenhuma cena gerada");

    // Generate image + audio for each scene in parallel
    const built = await Promise.all(scenes.map(async (scene, idx) => {
      // Image (non-streaming)
      const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-image-2",
          prompt: scene.imagePrompt + " cinematic, book illustration, no text",
          size: "1024x1024",
          quality: "low",
          n: 1,
        }),
      });
      let imageDataUrl = "";
      if (imgRes.ok) {
        const j = await imgRes.json();
        const b64 = j?.data?.[0]?.b64_json;
        if (b64) imageDataUrl = `data:image/png;base64,${b64}`;
      } else {
        console.error("image error scene", idx, imgRes.status, await imgRes.text());
      }

      // TTS via OpenAI tts-1
      const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "tts-1",
          input: scene.narration.slice(0, 1200),
          voice,
          response_format: "mp3",
        }),
      });
      let audioDataUrl = "";
      if (ttsRes.ok) {
        const buf = await ttsRes.arrayBuffer();
        audioDataUrl = `data:audio/mpeg;base64,${base64Encode(new Uint8Array(buf))}`;
      } else {
        console.error("tts error scene", idx, ttsRes.status, await ttsRes.text());
      }

      return { narration: scene.narration, imagePrompt: scene.imagePrompt, imageDataUrl, audioDataUrl };
    }));

    // Record generation
    await supabaseClient.from("story_videos").insert({
      user_id: user.id,
      book_id,
      book_title: title,
      mode,
      scenes_count: built.length,
    });

    const { data: newQuota } = await supabaseClient.rpc("can_generate_story_video", { _user_id: user.id });

    return new Response(JSON.stringify({ title, author, scenes: built, quota: newQuota }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-story-video error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
