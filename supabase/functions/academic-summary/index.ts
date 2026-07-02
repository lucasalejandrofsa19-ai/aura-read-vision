import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { captureEdgeError } from "../_shared/sentry.ts";
import { chatCompletion, generateImage } from "../_shared/ai-providers.ts";

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

    const body = await req.json();
    const {
      text,
      preview = false,
      style = "ABNT", // ABNT | APA | MLA | Vancouver | Chicago
      sourceType = "book", // book | article | website | journal | thesis
      author = "",
      title = "",
      year = "",
      publisher = "",
      city = "",
      url = "",
      accessedAt = "",
      journal = "",
      volume = "",
      issue = "",
      pages = "",
      doi = "",
      summaryLength = "medio", // curto | medio | longo
    } = body;

    if (!text || typeof text !== "string" || text.trim().length < 50) {
      return new Response(JSON.stringify({ error: "Forneça um texto com pelo menos 50 caracteres." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 100000) {
      return new Response(JSON.stringify({ error: "Texto excede 100.000 caracteres." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedStyles = ["ABNT", "APA", "MLA", "Vancouver", "Chicago"];
    if (!allowedStyles.includes(style)) {
      return new Response(JSON.stringify({ error: "Norma de citação inválida." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hasPremium } = await supabaseClient.rpc("has_premium_access", { _user_id: user.id });
    const isPreview = preview === true;

    if (!isPreview && !hasPremium) {
      await supabaseClient.from("premium_access_audit").insert({
        user_id: user.id, feature: "academic_summary", action: "generate",
        granted: false, reason: "No premium access",
      });
      return new Response(JSON.stringify({ error: "Recurso premium. Assine um plano para resumos acadêmicos completos." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isPreview) {
      await supabaseClient.from("premium_access_audit").insert({
        user_id: user.id, feature: "academic_summary", action: "generate", granted: true,
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const truncated = text.length > 60000 ? text.slice(0, 60000) : text;

    const lengthInstruction = isPreview
      ? "Crie um resumo BREVE com no máximo 80 palavras."
      : summaryLength === "curto"
      ? "Resumo conciso de 150-250 palavras."
      : summaryLength === "longo"
      ? "Resumo detalhado de 600-900 palavras."
      : "Resumo equilibrado de 300-500 palavras.";

    const metaBlock = `
Metadados da fonte (use para gerar citações e referência):
- Tipo: ${sourceType}
- Autor(es): ${author || "(não informado)"}
- Título: ${title || "(não informado)"}
- Ano: ${year || "(não informado)"}
- Editora: ${publisher || "(não informado)"}
- Cidade: ${city || "(não informado)"}
- Periódico: ${journal || "(não informado)"}
- Volume: ${volume || "(não informado)"}
- Número/Edição: ${issue || "(não informado)"}
- Páginas: ${pages || "(não informado)"}
- DOI: ${doi || "(não informado)"}
- URL: ${url || "(não informado)"}
- Data de acesso: ${accessedAt || "(não informado)"}
`;

    const systemPrompt = `Você é um assistente acadêmico especializado em sintetizar textos científicos e gerar citações e referências bibliográficas formatadas conforme normas reconhecidas (ABNT NBR 6023/10520, APA 7ª ed., MLA 9ª ed., Vancouver, Chicago).

Sua resposta DEVE ser um JSON válido (sem markdown, sem comentários) com a seguinte estrutura:

{
  "summary": "texto do resumo em parágrafos coesos, contendo citações diretas e indiretas no formato ${style} ao longo do texto",
  "keyPoints": ["ponto-chave 1", "ponto-chave 2", ...],
  "directQuotes": [{ "quote": "trecho literal", "page": "página ou seção se identificável", "citation": "citação no formato ${style}" }],
  "inTextCitations": ["exemplo de citação curta no formato ${style}", "..."],
  "reference": "referência bibliográfica completa formatada em ${style}",
  "keywords": ["palavra-chave 1", "palavra-chave 2", ...]
}

Regras CRÍTICAS:
- Norma exigida: ${style}.
- Não invente dados que não estejam nos metadados ou no texto. Se faltar informação, use marcadores como [s.l.], [s.n.], [s.d.] (ABNT) ou n.d. (APA), conforme a norma.
- Citações diretas devem ser literais (cópia exata do texto fornecido).
- Use português brasileiro.
- A referência completa deve seguir rigorosamente a norma ${style}.
- Inclua citações ao longo do resumo (autor-data ou numérico, conforme a norma).`;

    const userPrompt = `${metaBlock}

Texto acadêmico a ser resumido:
"""
${truncated}
"""

${lengthInstruction}

Gere o JSON conforme a estrutura definida, com citações no formato ${style}.`;

    const response = await chatCompletion({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
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
      throw new Error("Erro ao gerar resumo acadêmico");
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: try to extract JSON block
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { summary: raw };
    }

    return new Response(
      JSON.stringify({ ...parsed, isPreview, style }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    captureEdgeError(error, { function: "academic-summary" });
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
