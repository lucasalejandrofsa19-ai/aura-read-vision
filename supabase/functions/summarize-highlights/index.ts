import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { captureEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase para autenticação
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar acesso premium
    const { data: hasPremium, error: premiumError } = await supabaseClient.rpc(
      "has_premium_access",
      { _user_id: user.id }
    );

    if (premiumError || !hasPremium) {
      // Registrar auditoria
      await supabaseClient.from("premium_access_audit").insert({
        user_id: user.id,
        feature: "ai_summary",
        action: "generate_summary",
        granted: false,
        reason: "No premium access"
      });

      return new Response(
        JSON.stringify({ error: "Recurso premium. Assine um plano premium para gerar resumos com IA." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { highlights, preview } = await req.json();
    
    // Preview é permitido para todos, resumo completo só para premium
    const isPreview = preview === true;
    
    if (!isPreview) {
      // Registrar acesso premium ao resumo completo
      await supabaseClient.from("premium_access_audit").insert({
        user_id: user.id,
        feature: "ai_summary",
        action: "generate_full_summary",
        granted: true
      });
    }
    
    if (!highlights || highlights.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum destaque fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Preparar os textos destacados
    const highlightTexts = highlights
      .map((h: any, i: number) => `[Página ${h.page_number}]: ${h.text || "Sem texto extraído"}`)
      .join("\n\n");

    const systemPrompt = isPreview 
      ? `Você é um assistente especializado em criar resumos concisos. Crie um resumo MUITO BREVE (máximo 50 palavras) dos trechos destacados, focando apenas na ideia central principal.`
      : `Você é um assistente especializado em criar resumos concisos e informativos. 
Seu trabalho é analisar os trechos destacados de um livro e criar um resumo coerente que:
1. Identifique os temas principais presentes nos destaques
2. Agrupe ideias relacionadas
3. Crie uma narrativa fluida conectando os conceitos
4. Mantenha a essência e importância de cada destaque
5. Seja objetivo e direto, com no máximo 300 palavras

O resumo deve ajudar o leitor a entender rapidamente os pontos principais que ele considerou importantes no livro.`;

    const userPrompt = isPreview
      ? `Crie um resumo MUITO BREVE (máximo 50 palavras) dos seguintes destaques:\n\n${highlightTexts}\n\nApenas a ideia central principal.`
      : `Por favor, crie um resumo dos seguintes trechos destacados de um livro:\n\n${highlightTexts}\n\nForneça um resumo coeso e bem estruturado destes destaques.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
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
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente mais tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const errorText = await response.text();
      console.error("Erro da API Lovable:", response.status, errorText);
      throw new Error("Erro ao gerar resumo");
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ summary, isPreview }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    captureEdgeError(error, { function: "summarize-highlights" });
    console.error("Erro ao gerar resumo:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
