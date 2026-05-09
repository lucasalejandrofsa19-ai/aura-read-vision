import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { book_id, preview, text: clientText } = await req.json();
    if (!book_id) {
      return new Response(JSON.stringify({ error: "book_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPreview = preview === true;

    const { data: hasPremium } = await supabaseClient.rpc("has_premium_access", { _user_id: user.id });

    if (!isPreview && !hasPremium) {
      await supabaseClient.from("premium_access_audit").insert({
        user_id: user.id, feature: "book_summary", action: "generate_full_book_summary",
        granted: false, reason: "No premium access",
      });
      return new Response(JSON.stringify({ error: "Recurso premium. Assine para gerar resumos completos do livro." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch book (try user's books, then premium_books)
    let title = "";
    let author = "";
    let extractedText: string | null = null;

    const { data: bookData } = await supabaseClient
      .from("books")
      .select("title, author, extracted_text, user_id")
      .eq("id", book_id)
      .maybeSingle();

    if (bookData && bookData.user_id === user.id) {
      title = bookData.title;
      author = bookData.author || "";
      extractedText = bookData.extracted_text;
    } else {
      const { data: premiumBook } = await supabaseClient
        .from("premium_books")
        .select("title, author, extracted_text")
        .eq("id", book_id)
        .maybeSingle();
      if (premiumBook) {
        title = premiumBook.title;
        author = premiumBook.author || "";
        extractedText = premiumBook.extracted_text;
      }
    }

    if (!extractedText || extractedText.trim().length < 100) {
      return new Response(JSON.stringify({ error: "Texto do livro não disponível para resumo. Reprocesse o PDF." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Truncate to ~80k chars to fit context safely
    const MAX_CHARS = 80000;
    const truncated = extractedText.length > MAX_CHARS ? extractedText.slice(0, MAX_CHARS) : extractedText;

    if (!isPreview) {
      await supabaseClient.from("premium_access_audit").insert({
        user_id: user.id, feature: "book_summary", action: "generate_full_book_summary", granted: true,
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = isPreview
      ? `Você é um especialista em resumos de livros. Crie um resumo MUITO BREVE (máximo 80 palavras) destacando apenas a ideia central e o tema principal do livro.`
      : `Você é um especialista em análise literária e resumos profundos. Crie um resumo COMPLETO e ESTRUTURADO do livro, destacando as partes MAIS IMPORTANTES.

Estruture sua resposta em markdown com as seguintes seções:

## 📖 Visão Geral
Breve apresentação (2-3 parágrafos) sobre o tema central, gênero e proposta do livro.

## 🎯 Ideias Principais
Liste de 5 a 8 ideias-chave ou conceitos centrais defendidos no livro, com explicação.

## 🔑 Pontos Mais Importantes
Os trechos, capítulos ou argumentos de maior impacto e relevância. Explique por que são essenciais.

## 💡 Lições e Aprendizados
Principais lições práticas que o leitor pode extrair.

## 📌 Citações Memoráveis
Se houver passagens marcantes no texto, destaque-as.

## 🎓 Conclusão
Síntese final e por que vale a pena ler.

Seja profundo, fiel ao conteúdo do livro e didático. Use português brasileiro.`;

    const userPrompt = `Livro: "${title}"${author ? ` por ${author}` : ""}\n\nConteúdo do livro:\n\n${truncated}\n\n${isPreview ? "Crie um resumo muito breve (máx 80 palavras)." : "Crie um resumo completo e estruturado destacando as partes mais importantes."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente mais tarde." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Erro AI:", response.status, errorText);
      throw new Error("Erro ao gerar resumo do livro");
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    // Cache full summary in books.summary if it's a user book
    if (!isPreview && bookData && bookData.user_id === user.id) {
      await supabaseClient.from("books").update({ summary }).eq("id", book_id);
    }

    return new Response(JSON.stringify({ summary, isPreview, title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
