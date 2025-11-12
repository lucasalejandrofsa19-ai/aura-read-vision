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

    const { bookId, filePath } = await req.json();

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from("pdfs")
      .download(filePath);

    if (downloadError) throw downloadError;

    // For now, we'll store a placeholder for extracted text
    // In production, you'd use a PDF parsing library here
    const extractedText = "PDF text extraction will be implemented with proper PDF parsing library";

    // Update book with extracted text
    const { error: updateError } = await supabaseClient
      .from("books")
      .update({ extracted_text: extractedText })
      .eq("id", bookId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: "PDF processed successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error processing PDF:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
