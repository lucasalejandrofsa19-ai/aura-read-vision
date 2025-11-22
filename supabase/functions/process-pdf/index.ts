import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { bookId, coverImage } = await req.json();
    console.log(`Updating cover for book ${bookId}`);

    if (!coverImage) {
      throw new Error("No cover image provided");
    }

    // Decode base64 image
    const base64Data = coverImage.split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const blob = new Blob([binaryData], { type: 'image/png' });

    // Upload cover to storage
    const coverFileName = `${bookId}-cover.png`;
    const { error: uploadError } = await supabaseClient.storage
      .from("premium-covers")
      .upload(coverFileName, blob, {
        contentType: "image/png",
        upsert: true
      });

    if (uploadError) {
      console.error("Cover upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from("premium-covers")
      .getPublicUrl(coverFileName);
    
    const coverImageUrl = urlData.publicUrl;
    console.log("Cover uploaded:", coverImageUrl);

    // Update book with cover
    const { error: updateError } = await supabaseClient
      .from("books")
      .update({ cover_image_url: coverImageUrl })
      .eq("id", bookId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    console.log("Book cover updated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Cover updated successfully",
        coverImageUrl 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error processing cover:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
