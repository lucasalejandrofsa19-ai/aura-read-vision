// Returns a draft script (titles + narration text) so the user can edit each
// scene's narration BEFORE the heavy image+audio generation runs.
// No images, no audio — fast.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { captureEdgeError } from "../_shared/sentry.ts";
import { chatCompletion, generateImage } from "../_shared/ai-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DraftScene = {
  chapterTitle: string;
  narration: string;
  imagePrompt?: string;
  highlightId?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const book_id = body.book_id as string;
    const mode = (body.mode as string) || "summary";
    const scenesCount = Math.max(3, Math.min(14, Number(body.scenesCount) || 5));
    const clientText = body.text as string | undefined;
    if (!book_id) {
      return new Response(JSON.stringify({ error: "book_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let title = ""; let author = "";
    const { data: bookData } = await sb.from("books")
      .select("title, author, user_id, extracted_text").eq("id", book_id).maybeSingle();
    let extractedText: string | null = null;
    if (bookData && bookData.user_id === user.id) {
      title = bookData.title; author = bookData.author || "";
      extractedText = bookData.extracted_text;
    } else {
      const { data: pb } = await sb.from("premium_books")
        .select("title, author, extracted_text").eq("id", book_id).maybeSingle();
      if (pb) { title = pb.title; author = pb.author || ""; extractedText = pb.extracted_text; }
    }

    // ---- Mode: highlights → return user's highlights as draft scenes
    if (mode === "highlights") {
      const { data: hls, error: hlErr } = await sb
        .from("highlights")
        .select("id, text, page_number, highlight_images(storage_path)")
        .eq("user_id", user.id)
        .eq("book_id", book_id)
        .order("page_number", { ascending: true });
      if (hlErr) {
        return new Response(JSON.stringify({ error: "Falha ao buscar destaques: " + hlErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const withImg = (hls || [])
        .map((h: any) => ({
          id: h.id, text: (h.text || "").trim(), page_number: h.page_number,
          hasImg: Array.isArray(h.highlight_images) && h.highlight_images.length > 0,
        }))
        .filter(h => h.text.length >= 4 && h.hasImg)
        .slice(0, scenesCount);
      const scenes: DraftScene[] = withImg.map((h, i) => ({
        highlightId: h.id,
        chapterTitle: `Destaque ${i + 1} · pág. ${h.page_number}`,
        narration: h.text,
      }));
      return new Response(JSON.stringify({ title, author, mode, scenes }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Mode: summary (IA) → ask Gemini for chapters
    if (!Deno.env.get("GEMINI_API_KEY") && !Deno.env.get("LOVABLE_API_KEY")) throw new Error("Nenhum provedor de IA configurado");
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Prefer user-provided excerpt (e.g. selected chapter/section) when present.
    if (typeof clientText === "string" && clientText.trim().length >= 50) {
      extractedText = clientText;
    }
    if (!extractedText || extractedText.trim().length < 50) {
      if (!title) {
        return new Response(JSON.stringify({ error: "Texto do livro não disponível para análise. Use o modo 'Trecho do livro' e cole um capítulo, ou reenvie o livro para extrair o texto." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Fallback: no extracted text and no excerpt — let the IA improvise from title/author.
      extractedText = `Sem texto extraído. Crie mini-histórias originais e coerentes inspiradas no livro "${title}"${author ? ` de ${author}` : ""}, baseando-se em temas e atmosfera comumente associados a esta obra.`;
    }
    const truncated = extractedText.length > 50000 ? extractedText.slice(0, 50000) : extractedText;
    const n = scenesCount;
    const wordsPerScene = Math.max(10, Math.floor(190 / n));
    const seed = body.variationSeed ?? Math.floor(Math.random() * 1e9);

    const sysPrompt = `Você cria roteiros de vídeos verticais 9:16 narrados sobre livros, em PT-BR.
Analise o livro e divida em EXATAMENTE ${n} mini-histórias coesas. Para CADA mini-história produza:
- "chapterTitle": 3-6 palavras
- "narration": UMA frase fluida (${wordsPerScene}-${wordsPerScene + 4} palavras), envolvente, sem emojis/markdown
- "imagePrompt": descrição visual em INGLÊS (máx 20 palavras), cinematográfica, vertical 9:16, sem texto
Responda APENAS JSON: {"chapters":[{"chapterTitle":"...","narration":"...","imagePrompt":"..."}]}`;
    const userPrompt = `Livro: "${title}"${author ? ` por ${author}` : ""}\nSeed: ${seed}\n\nConteúdo:\n${truncated}`;

    const scriptRes = await chatCompletion({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 6000,
        temperature: 0.9,
      });
    if (!scriptRes.ok) {
      const t = await scriptRes.text();
      console.error("script error", scriptRes.status, t);
      return new Response(JSON.stringify({ error: scriptRes.status === 402 ? "Créditos de IA esgotados." : "Falha ao gerar roteiro" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const scriptData = await scriptRes.json();
    const raw: string = scriptData.choices?.[0]?.message?.content ?? "";
    let parsed: { chapters: { chapterTitle: string; narration: string; imagePrompt: string }[] };
    try { parsed = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) {
        return new Response(JSON.stringify({ error: "Roteiro inválido retornado pela IA" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      parsed = JSON.parse(m[0]);
    }
    const scenes: DraftScene[] = (parsed.chapters || []).slice(0, n)
      .filter(c => c.narration && c.imagePrompt)
      .map((c, i) => ({
        chapterTitle: c.chapterTitle || `Cena ${i + 1}`,
        narration: c.narration,
        imagePrompt: c.imagePrompt,
      }));
    if (scenes.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma mini-história gerada" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ title, author, mode, scenes }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    captureEdgeError(error, { function: "generate-story-video-script" });
    console.error("generate-story-video-script error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
