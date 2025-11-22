import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to generate cover image from first PDF page
async function generateCoverFromPDF(pdfBytes: Uint8Array): Promise<Blob> {
  try {
    // Use Lovable AI image generation to create a book cover
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: "Generate a beautiful, professional book cover design with an abstract pattern. Make it elegant and suitable for an ebook library. Use rich colors and modern design."
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      throw new Error(`AI generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      throw new Error("No image generated");
    }

    // Convert base64 to blob
    const base64Data = imageUrl.split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    return new Blob([binaryData], { type: 'image/png' });
    
  } catch (error) {
    console.error("Error generating cover:", error);
    throw error;
  }
}

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
    console.log(`Processing PDF for book ${bookId}, file: ${filePath}`);

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from("pdfs")
      .download(filePath);

    if (downloadError) {
      console.error("Download error:", downloadError);
      throw downloadError;
    }

    console.log("PDF downloaded, generating cover...");

    // Convert file to Uint8Array
    const pdfBytes = new Uint8Array(await fileData.arrayBuffer());

    // Generate cover image from first page
    let coverImageUrl = null;
    try {
      const coverBlob = await generateCoverFromPDF(pdfBytes);
      
      // Upload cover to storage
      const coverFileName = `${bookId}-cover.png`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from("premium-covers")
        .upload(coverFileName, coverBlob, {
          contentType: "image/png",
          upsert: true
        });

      if (uploadError) {
        console.error("Cover upload error:", uploadError);
      } else {
        // Get public URL
        const { data: urlData } = supabaseClient.storage
          .from("premium-covers")
          .getPublicUrl(coverFileName);
        
        coverImageUrl = urlData.publicUrl;
        console.log("Cover generated and uploaded:", coverImageUrl);
      }
    } catch (coverError) {
      console.error("Error generating cover:", coverError);
      // Continue without cover
    }

    // Extract basic metadata
    const extractedText = "PDF text extraction placeholder";
    const totalPages = 1; // Placeholder

    // Update book with extracted text and cover
    const updateData: any = { 
      extracted_text: extractedText,
      total_pages: totalPages
    };
    
    if (coverImageUrl) {
      updateData.cover_image_url = coverImageUrl;
    }

    const { error: updateError } = await supabaseClient
      .from("books")
      .update(updateData)
      .eq("id", bookId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    console.log("Book updated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "PDF processed successfully",
        coverImageUrl 
      }),
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
