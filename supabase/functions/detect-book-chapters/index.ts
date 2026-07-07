import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { captureEdgeError } from "../_shared/sentry.ts";
import { chatCompletion } from "../_shared/ai-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChapterOut {
  title: string;
  summary: string;
  startSnippet: string;
  endSnippet: string;
  startIndex?: number;
  endIndex?: number;
  excerpt?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { book_id, text: clientText } = await req.json();
    if (!book_id) {
      return new Response(JSON.stringify({ error: "book_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch book text
    let title = ""; let extractedText: string | null = null;
    const { data: bookData } = await supabaseClient.from("books")
      .select("title, extracted_text, user_id").eq("id", book_id).maybeSingle();
    if (bookData && bookData.user_id === user.id) {
      title = bookData.title; extractedText = bookData.extracted_text;
    } else {
      const { data: pb } = await supabaseClient.from("premium_books")
        .select("title, extracted_text").eq("id", book_id).maybeSingle();
      if (pb) { title = pb.title; extractedText = pb.extracted_text; }
    }
    if ((!extractedText || extractedText.trim().length < 200) && typeof clientText === "string" && clientText.length > 200) {
      extractedText = clientText;
    }
    if (!extractedText || extractedText.trim().length < 200) {
      return new Response(JSON.stringify({ error: "Texto do livro não disponível. Abra o livro no leitor primeiro.", needsClientExtraction: true }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // provider key check moved to shared helper

    const MAX = 60000;
    const truncated = extractedText.length > MAX ? extractedText.slice(0, MAX) : extractedText;

    const systemPrompt = `Você analisa o texto de um livro e divide em capítulos lógicos para gerar vídeos curtos.
Retorne entre 3 e 10 capítulos consecutivos, cobrindo a obra do início ao fim.
Para cada capítulo, forneça:
- "title": título curto e atrativo em português (3 a 8 palavras).
- "summary": resumo do capítulo em UMA frase em português (até 25 palavras).
- "startSnippet": copie LITERALMENTE entre 30 e 60 caracteres do início desse capítulo no texto fornecido (deve aparecer exatamente).
- "endSnippet": copie LITERALMENTE entre 30 e 60 caracteres do fim desse capítulo no texto fornecido (deve aparecer exatamente).

Responda APENAS com JSON válido: {"chapters":[{"title":"...","summary":"...","startSnippet":"...","endSnippet":"..."}]}`;

    const userPrompt = `Livro: "${title}"\n\nTexto:\n${truncated}`;

    const res = await chatCompletion({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("chapters error", res.status, t);
      if (res.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Falha ao detectar capítulos");
    }
    const data = await res.json();
    let parsed: { chapters: ChapterOut[] };
    try { parsed = JSON.parse(data.choices[0].message.content); } catch (e) {
      throw new Error("Resposta inválida da IA");
    }

    // Localize snippets in extractedText to extract excerpt
    const chapters: ChapterOut[] = (parsed.chapters || []).map((c) => {
      const startIdx = c.startSnippet ? extractedText!.indexOf(c.startSnippet) : -1;
      const endIdx = c.endSnippet ? extractedText!.indexOf(c.endSnippet) : -1;
      let excerpt = "";
      if (startIdx >= 0 && endIdx > startIdx) {
        excerpt = extractedText!.slice(startIdx, endIdx + c.endSnippet.length);
      } else if (startIdx >= 0) {
        excerpt = extractedText!.slice(startIdx, Math.min(extractedText!.length, startIdx + 8000));
      }
      return {
        ...c,
        startIndex: startIdx >= 0 ? startIdx : undefined,
        endIndex: endIdx >= 0 ? endIdx : undefined,
        excerpt: excerpt || undefined,
      };
    }).filter((c) => c.title && c.summary);

    if (chapters.length === 0) throw new Error("Nenhum capítulo detectado");

    // Fallback: if some excerpts couldn't be localized, split text evenly for those
    const total = extractedText.length;
    const chunk = Math.floor(total / chapters.length);
    chapters.forEach((c, i) => {
      if (!c.excerpt) {
        const s = i * chunk;
        const e = i === chapters.length - 1 ? total : (i + 1) * chunk;
        c.excerpt = extractedText!.slice(s, e);
      }
    });

    return new Response(JSON.stringify({ title, chapters }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    captureEdgeError(error, { function: "detect-book-chapters" });
    console.error("detect-book-chapters error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
