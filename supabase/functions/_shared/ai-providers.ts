// Roteador híbrido de IA:
//  - Tarefas PESADAS (texto longo / imagem) → Google Gemini direto (GEMINI_API_KEY)
//  - Fallback → Lovable AI Gateway (LOVABLE_API_KEY) se a chave externa faltar
//  - TTS pesado → ElevenLabs (audiobook-tts) — já implementado no próprio handler
//
// O objetivo é preservar créditos Lovable para tarefas leves (deepen-topic,
// summarize-highlights, enhance-narration, detect-book-chapters, regenerate-scene).

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Mapeia nome do modelo do Lovable p/ id nativo do Gemini
function mapModelToGemini(model: string | undefined): string {
  if (!model) return "gemini-2.5-flash";
  const m = model.replace(/^google\//, "");
  // Aceita "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite" etc.
  if (m.startsWith("gemini-")) return m.replace(/-preview$/, "");
  // Fallback razoável
  return "gemini-2.5-flash";
}

/**
 * Chat completion no formato OpenAI-compatible.
 * Tenta Gemini direto (endpoint compatível com OpenAI); se falhar/ausente, cai no Lovable.
 * Retorna sempre um Response no formato /v1/chat/completions.
 */
export async function chatCompletion(body: Record<string, unknown>): Promise<Response> {
  if (GEMINI_API_KEY) {
    const geminiBody = { ...body, model: mapModelToGemini(body.model as string | undefined) };
    // Gemini não conhece "modalities" — remove
    delete (geminiBody as any).modalities;
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiBody),
      },
    );
    // Fallback Lovable em erros de auth (401/403) e quota (402/429)
    const FALLBACK_STATUSES = new Set([401, 402, 403, 429]);
    if (res.ok || !FALLBACK_STATUSES.has(res.status)) {
      return res;
    }
    console.warn(`[ai-providers] Gemini retornou ${res.status}; tentando fallback Lovable`);

  }
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Nenhum provedor de IA configurado (GEMINI_API_KEY ou LOVABLE_API_KEY)" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Geração de imagem via Gemini (Nano Banana).
 * Retorna base64 puro (sem prefixo data:).
 */
export async function generateImage(
  prompt: string,
): Promise<{ base64: string; mimeType: string; provider: "gemini" | "lovable" }> {
  if (GEMINI_API_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      // Fallback Lovable em auth (401/403) e quota (402/429); demais → propaga
      const FALLBACK_STATUSES = new Set([401, 402, 403, 429]);
      if (!FALLBACK_STATUSES.has(res.status)) {
        throw new Error(`Gemini image ${res.status}: ${err}`);
      }
      console.warn(`[ai-providers] Gemini image ${res.status}; fallback Lovable`);
    } else {
      const data = await res.json();
      const part = data?.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData || p.inline_data,
      );
      const inline = part?.inlineData || part?.inline_data;
      if (!inline?.data) throw new Error("Gemini não retornou dados de imagem");
      return {
        base64: inline.data,
        mimeType: inline.mimeType || inline.mime_type || "image/png",
        provider: "gemini",
      };
    }
  }
  // Fallback Lovable via chat endpoint (formato antigo do projeto)
  if (!LOVABLE_API_KEY) throw new Error("Nenhuma chave de imagem configurada");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) throw new Error(`Lovable image ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const url: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("Lovable não retornou imagem");
  const base64 = url.split(",")[1] || "";
  return { base64, mimeType: "image/png", provider: "lovable" };
}

