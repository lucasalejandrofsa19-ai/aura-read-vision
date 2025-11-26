import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { highlights } = await req.json();
    
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

    const systemPrompt = `Você é um assistente especializado em criar resumos concisos e informativos. 
Seu trabalho é analisar os trechos destacados de um livro e criar um resumo coerente que:
1. Identifique os temas principais presentes nos destaques
2. Agrupe ideias relacionadas
3. Crie uma narrativa fluida conectando os conceitos
4. Mantenha a essência e importância de cada destaque
5. Seja objetivo e direto, com no máximo 300 palavras

O resumo deve ajudar o leitor a entender rapidamente os pontos principais que ele considerou importantes no livro.`;

    const userPrompt = `Por favor, crie um resumo dos seguintes trechos destacados de um livro:

${highlightTexts}

Forneça um resumo coeso e bem estruturado destes destaques.`;

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
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao gerar resumo:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
