import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const processPdfInputSchema = z.object({
  bookId: z
    .string()
    .trim()
    .uuid({ message: "Invalid book ID" }),
  filePath: z
    .string()
    .trim()
    .min(1, { message: "File path is required" })
    .max(1024, { message: "File path too long" })
    .regex(/^[a-zA-Z0-9\/_\-\.]+$/, {
      message: "File path contains invalid characters",
    }),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = processPdfInputSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      throw new Error(validation.error.errors[0].message);
    }

    const { bookId, filePath } = validation.data;

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('pdfs')
      .download(filePath);

    if (downloadError) throw downloadError;

    // For now, we'll store a placeholder for extracted text
    // In production, you'd use a PDF parsing library here
    const extractedText = 'PDF text extraction will be implemented with proper PDF parsing library';

    // Update book with extracted text
    const { error: updateError } = await supabaseClient
      .from('books')
      .update({ extracted_text: extractedText })
      .eq('id', bookId)
      .eq('user_id', userData.user.id); // Ensure user owns the book

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: 'PDF processed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
