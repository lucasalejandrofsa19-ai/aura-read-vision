import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { captureEdgeError } from "../_shared/sentry.ts";
import { chatCompletion } from "../_shared/ai-providers.ts";

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
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hasPremium, error: premErr } = await supabaseClient.rpc("has_premium_access", { _user_id: user.id });
    if (premErr || !hasPremium) {
      return new Response(JSON.stringify({ error: "Acesso premium necessário" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    const { summary, bookTitle, topic } = await req.json();
    const baseText = (topic || summary || "").toString().trim();
    if (!baseText || baseText.length < 30) {
      return new Response(JSON.stringify({ error: "Forneça um resumo ou tópico válido (mín. 30 caracteres)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const truncated = baseText.slice(0, 8000);

    const systemPrompt = `Você é um pesquisador acadêmico que sugere recursos para aprofundar o conhecimento sobre temas específicos. Responda SEMPRE em português brasileiro com um JSON válido, sem markdown.

Estrutura obrigatória:
{
  "topics": ["tópico-chave 1", "tópico-chave 2", "tópico-chave 3"],
  "articles": [{"title": "...", "description": "breve descrição", "searchQuery": "consulta para Google Scholar/Google"}],
  "videos": [{"title": "...", "description": "...", "searchQuery": "consulta para YouTube"}],
  "books": [{"title": "...", "author": "autor", "description": "por que ler"}],
  "questions": ["pergunta reflexiva 1", "pergunta reflexiva 2", "pergunta reflexiva 3"]
}

Regras:
- 3 a 5 itens por categoria.
- NÃO invente URLs. Use apenas searchQuery (texto de busca).
- Sugestões reais e plausíveis (autores reais, livros conhecidos quando possível).
- Foque nos conceitos centrais do texto fornecido.`;

    const userPrompt = `Livro: ${bookTitle || "(não informado)"}

Resumo / Tópico:
"""
${truncated}
"""

Sugira recursos para aprofundar o conhecimento sobre os temas centrais.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente mais tarde." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("Erro ao gerar sugestões");
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    captureEdgeError(error, { function: "deepen-topic" });
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
