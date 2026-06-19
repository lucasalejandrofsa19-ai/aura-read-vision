import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a hash for cache key
async function hashText(text: string, voiceId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`elevenlabs:${voiceId}:${text}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new TextDecoder().decode(hexEncode(new Uint8Array(hashBuffer)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1.4 fix: auth + size validation BEFORE parsing body (DoS protection)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > 100_000) {
      return new Response(JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { text, voiceId = "JBFqnCBsd6RMkjVDRZzb", previousText, nextText } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    // Validate voiceId format to prevent URL path injection
    if (typeof voiceId !== 'string' || !/^[a-zA-Z0-9]{16,40}$/.test(voiceId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid voiceId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for storage operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );


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
    const truncatedText = text.slice(0, 5000);

    // Generate cache key based on text and voice
    const cacheKey = await hashText(truncatedText, voiceId);
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

    console.log(`Cache miss, generating TTS for ${truncatedText.length} characters with stitching: prev=${!!previousText}, next=${!!nextText}`);

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    // Build request body with optional request stitching
    const requestBody: any = {
      text: truncatedText,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
        speed: 1.0,
      },
    };

    // Add request stitching context for smooth transitions
    if (previousText) {
      requestBody.previous_text = previousText.slice(-200);
    }
    if (nextText) {
      requestBody.next_text = nextText.slice(0, 200);
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);

      // Parse to extract status for better frontend handling
      let parsedError: any = {};
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = { detail: { message: errorText } };
      }

      const status = parsedError?.detail?.status;
      const message = parsedError?.detail?.message || 'Unknown error';

      // Map common ElevenLabs errors to clearer responses
      let mappedStatus = response.status;
      if (status === 'quota_exceeded') {
        mappedStatus = 402; // Payment Required
      }

      return new Response(
        JSON.stringify({
          error: `ElevenLabs API error: ${response.status}`,
          details: errorText,
          status_code: status,
          message,
        }),
        {
          status: mappedStatus,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const audioBuffer = await response.arrayBuffer();

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
    console.error('Error in audiobook-tts:', error);
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
