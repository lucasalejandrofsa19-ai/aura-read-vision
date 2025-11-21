import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { text, style = 'photorealistic', highlightId } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    if (!highlightId) {
      throw new Error('Highlight ID is required');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`[TEXT-TO-IMAGE] Generating image for user: ${user.id}, highlight: ${highlightId}, style: ${style}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Create a visual prompt based on the highlighted text and chosen style
    const styleDescription = stylePrompts[style] || stylePrompts.photorealistic;
    const imagePrompt = `Create a beautiful, artistic illustration that represents this concept: "${text}". 
    Style: ${styleDescription}. Make it visually appealing, creative and easy to understand.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: imagePrompt,
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TEXT-TO-IMAGE] AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('Payment required. Please add credits to your workspace.');
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[TEXT-TO-IMAGE] Response received');

    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image generated');
    }

    console.log('[TEXT-TO-IMAGE] Image generated, uploading to storage...');

    // Convert base64 to blob
    const base64Data = imageUrl.split(',')[1];
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

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('highlight-images')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    console.log('[TEXT-TO-IMAGE] Image uploaded, saving to database...');

    // Save to database
    const { error: dbError } = await supabaseClient
      .from('highlight_images')
      .insert({
        highlight_id: highlightId,
        user_id: user.id,
        image_url: publicUrl,
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
        imageUrl: publicUrl,
        prompt: imagePrompt,
        style: style,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
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
