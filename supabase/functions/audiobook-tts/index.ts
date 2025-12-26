import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId = "JBFqnCBsd6RMkjVDRZzb", previousText, nextText } = await req.json();
    
    if (!text) {
      throw new Error('Text is required');
    }

    // Verify premium access
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

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    // Limit text length to prevent very long requests
    const truncatedText = text.slice(0, 5000);

    console.log(`Generating TTS for ${truncatedText.length} characters with stitching: prev=${!!previousText}, next=${!!nextText}`);

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

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
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
