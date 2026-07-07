import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureEdgeError } from "../_shared/sentry.ts";
import { generateImage } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stylePrompts: Record<string, string> = {
  photorealistic: "photorealistic, highly detailed, realistic lighting, professional photography, 8k quality",
  cartoon: "cartoon style, vibrant colors, animated, playful, illustrated, bold outlines",
  painting: "oil painting style, artistic, textured brushstrokes, gallery quality, fine art",
  minimalist: "minimalist design, clean lines, simple shapes, modern, elegant, flat design",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1.4 fix: auth + size validation BEFORE parsing body
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > 100_000) {
      return new Response(JSON.stringify({ error: 'Payload too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { text, style = 'photorealistic', highlightId } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    if (!highlightId) {
      throw new Error('Highlight ID is required');
    }

    // Validate highlightId is a UUID to prevent path traversal in storage paths
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof highlightId !== 'string' || !UUID_RE.test(highlightId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid highlightId format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }


    console.log(`[TEXT-TO-IMAGE] Generating image for user: ${user.id}, highlight: ${highlightId}, style: ${style}`);

    // Verify the highlight belongs to the authenticated user
    const { data: highlightRow, error: highlightErr } = await supabaseClient
      .from('highlights')
      .select('id, user_id')
      .eq('id', highlightId)
      .maybeSingle();

    if (highlightErr || !highlightRow || highlightRow.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Highlight not found or access denied' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Admin bypass: unlimited image generation
    const { data: isAdminUser } = await supabaseClient.rpc('is_admin', { _user_id: user.id });

    // Check how many images the user has generated
    const { count, error: countError } = await supabaseClient
      .from('highlight_images')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('[TEXT-TO-IMAGE] Error counting images:', countError);
    }

    const imageCount = count || 0;
    console.log(`[TEXT-TO-IMAGE] User has generated ${imageCount} images (admin=${!!isAdminUser})`);

    // Check if user has premium access
    const FREE_IMAGE_LIMIT = 3;
    if (!isAdminUser && imageCount >= FREE_IMAGE_LIMIT) {

      console.log('[TEXT-TO-IMAGE] User reached free limit, checking premium access...');
      
      // Verify premium access using edge function
      const { data: premiumData, error: premiumError } = await supabaseClient.functions.invoke(
        'verify-premium-access',
        { headers: { Authorization: req.headers.get('Authorization') || '' } }
      );

      if (premiumError) {
        console.error('[TEXT-TO-IMAGE] Error checking premium:', premiumError);
        throw new Error('Erro ao verificar acesso premium');
      }

      const hasPremiumAccess = premiumData?.hasPremiumAccess || false;
      console.log(`[TEXT-TO-IMAGE] Premium access: ${hasPremiumAccess}`);

      if (!hasPremiumAccess) {
        return new Response(
          JSON.stringify({ 
            error: 'limit_reached',
            message: `Você atingiu o limite de ${FREE_IMAGE_LIMIT} imagens gratuitas. Assine o plano Premium para gerar imagens ilimitadas.`,
            imageCount,
            limit: FREE_IMAGE_LIMIT
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }
      
      console.log('[TEXT-TO-IMAGE] Premium user, proceeding with generation');
    }

    // Cria prompt visual com base no destaque e estilo escolhido
    const styleDescription = stylePrompts[style] || stylePrompts.photorealistic;
    const imagePrompt = `Create a beautiful, artistic illustration that represents this concept: "${text}". 
    Style: ${styleDescription}. Make it visually appealing, creative and easy to understand.`;

    let base64Data = "";
    let provider: "gemini" | "lovable" = "gemini";
    try {
      const img = await generateImage(imagePrompt);
      base64Data = img.base64;
      provider = img.provider;

    } catch (err) {
      console.error('[TEXT-TO-IMAGE] Image gen error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (/429/.test(msg)) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (/402/.test(msg)) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Image generation error: ${msg}`);
    }

    if (!base64Data) {
      throw new Error('No image generated');
    }

    console.log('[TEXT-TO-IMAGE] Image generated, uploading to storage...');

    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Upload to Supabase Storage
    const fileName = `${user.id}/${highlightId}-${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('highlight-images')
      .upload(fileName, binaryData, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('[TEXT-TO-IMAGE] Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Bucket is private — generate a signed URL for immediate display
    const { data: signedData } = await supabaseClient.storage
      .from('highlight-images')
      .createSignedUrl(fileName, 60 * 60);

    const displayUrl = signedData?.signedUrl ?? '';

    console.log('[TEXT-TO-IMAGE] Image uploaded, saving to database...');

    // Save to database (store path; sign on read)
    const { error: dbError } = await supabaseClient
      .from('highlight_images')
      .insert({
        highlight_id: highlightId,
        user_id: user.id,
        image_url: fileName,
        storage_path: fileName,
        style: style,
        prompt: imagePrompt,
      });

    if (dbError) {
      console.error('[TEXT-TO-IMAGE] Database error:', dbError);
      // Try to clean up uploaded file
      await supabaseClient.storage
        .from('highlight-images')
        .remove([fileName]);
      throw new Error(`Failed to save image record: ${dbError.message}`);
    }

    console.log('[TEXT-TO-IMAGE] Image saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: displayUrl,
        prompt: imagePrompt,
        style: style,
        provider,

      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    captureEdgeError(error, { function: "text-to-image" });
    console.error('[TEXT-TO-IMAGE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
