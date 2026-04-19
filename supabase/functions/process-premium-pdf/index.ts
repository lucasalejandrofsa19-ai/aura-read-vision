import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  bookId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Verificar autenticação e admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`[PROCESS-PREMIUM-PDF] Processing request for user: ${user.id}`);

    // Verificar se usuário é admin
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = (roles || []).some(r => r.role === 'admin');
    if (!isAdmin) {
      throw new Error('Only admins can process premium PDFs');
    }

    const { bookId }: ProcessRequest = await req.json();

    if (!bookId) {
      throw new Error('Book ID is required');
    }

    console.log(`[PROCESS-PREMIUM-PDF] Processing book: ${bookId}`);

    // Buscar informações do livro
    const { data: book, error: bookError } = await supabaseClient
      .from('premium_books')
      .select('*')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      throw new Error('Book not found');
    }

    console.log(`[PROCESS-PREMIUM-PDF] Found book: ${book.title}`);

    // Baixar PDF do storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('premium-pdfs')
      .download(book.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message}`);
    }

    console.log(`[PROCESS-PREMIUM-PDF] PDF downloaded, size: ${fileData.size} bytes`);

    // Converter Blob para ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log(`[PROCESS-PREMIUM-PDF] Starting PDF processing...`);

    // Extract text + page count using unpdf (Deno-compatible, no native deps)
    const pdfDoc = await getDocumentProxy(uint8Array);
    const numPages = pdfDoc.numPages;
    const { text } = await extractText(pdfDoc, { mergePages: true });
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    console.log(`[PROCESS-PREMIUM-PDF] PDF processed - Pages: ${numPages}, Text length: ${fullText.length}`);

    // Limit stored text to avoid bloating the database
    const extractedText = fullText.substring(0, 50000);

    // Note: Cover thumbnail is generated client-side after upload
    // (Deno edge runtime cannot run the canvas native module).

    // Atualizar registro do livro
    const updateData: Record<string, unknown> = {
      total_pages: numPages,
      extracted_text: extractedText,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseClient
      .from('premium_books')
      .update(updateData)
      .eq('id', bookId);

    if (updateError) {
      throw new Error(`Failed to update book: ${updateError.message}`);
    }

    console.log(`[PROCESS-PREMIUM-PDF] Book updated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        bookId,
        totalPages: numPages,
        textLength: extractedText.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[PROCESS-PREMIUM-PDF] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isUnauthorized = errorMessage.includes('Unauthorized') || errorMessage.includes('admin');

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: isUnauthorized ? 403 : 500,
      }
    );
  }
});
