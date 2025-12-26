import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a hash for cache key
async function hashText(text: string, voice: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`openai:${voice}:${text}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new TextDecoder().decode(hexEncode(new Uint8Array(hashBuffer)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = "alloy" } = await req.json();
    
    if (!text) {
      throw new Error('Text is required');
    }

    // Create admin client for storage operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create user client for auth verification
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    // Check premium access
    const { data: hasPremium, error: premiumError } = await supabaseClient
      .rpc('has_premium_access', { _user_id: user.id });

    if (premiumError || !hasPremium) {
      return new Response(
        JSON.stringify({ error: "Premium access required" }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Limit text length to prevent very long requests
    const truncatedText = text.slice(0, 4096);

    // OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = validVoices.includes(voice) ? voice : 'alloy';

    // Generate cache key based on text and voice
    const cacheKey = await hashText(truncatedText, selectedVoice);
    const cachePath = `${user.id}/${cacheKey}.mp3`;

    // Check if cached audio exists
    const { data: cachedFile } = await supabaseAdmin.storage
      .from('audiobook-cache')
      .download(cachePath);

    if (cachedFile) {
      console.log(`Cache hit for ${truncatedText.length} chars, key: ${cacheKey.slice(0, 8)}...`);
      const audioBuffer = await cachedFile.arrayBuffer();
      return new Response(audioBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'X-Cache': 'HIT',
        },
      });
    }

    console.log(`Cache miss, generating OpenAI TTS for ${truncatedText.length} characters with voice: ${selectedVoice}`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: truncatedText,
        voice: selectedVoice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI TTS API error:', response.status, errorText);

      return new Response(
        JSON.stringify({
          error: `OpenAI TTS API error: ${response.status}`,
          details: errorText,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`Generated audio: ${audioBuffer.byteLength} bytes`);

    // Cache the audio in storage (fire-and-forget)
    EdgeRuntime.waitUntil(
      supabaseAdmin.storage
        .from('audiobook-cache')
        .upload(cachePath, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to cache audio:', error.message);
          } else {
            console.log(`Cached audio: ${cacheKey.slice(0, 8)}...`);
          }
        })
    );

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error in openai-tts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
