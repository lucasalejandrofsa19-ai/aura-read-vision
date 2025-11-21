import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCanvas } from "https://deno.land/x/canvas@v1.4.1/mod.ts";

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

    // Processar PDF usando pdf-parse
    const pdfParse = await import('https://esm.sh/pdf-parse@1.1.1');
    const pdfData = await pdfParse.default(uint8Array);

    console.log(`[PROCESS-PREMIUM-PDF] PDF processed - Pages: ${pdfData.numpages}, Text length: ${pdfData.text.length}`);

    // Extrair apenas uma amostra do texto para não sobrecarregar o banco
    const extractedText = pdfData.text.substring(0, 50000); // Primeiros 50k caracteres

    // Gerar thumbnail da primeira página
    let coverImageUrl = null;
    try {
      console.log(`[PROCESS-PREMIUM-PDF] Generating thumbnail...`);
      
      const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.min.mjs');
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdfDoc = await loadingTask.promise;
      
      // Get first page
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      
      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Render page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      // Convert canvas to PNG buffer
      const thumbnailBuffer = canvas.toBuffer('image/png');
      
      // Upload thumbnail to storage
      const coverFileName = `${bookId}-cover.png`;
      const { error: uploadError } = await supabaseClient.storage
        .from('premium-covers')
        .upload(coverFileName, thumbnailBuffer, {
          contentType: 'image/png',
          upsert: true,
        });
      
      if (uploadError) {
        console.error(`[PROCESS-PREMIUM-PDF] Error uploading thumbnail:`, uploadError);
      } else {
        const { data: urlData } = supabaseClient.storage
          .from('premium-covers')
          .getPublicUrl(coverFileName);
        coverImageUrl = urlData.publicUrl;
        console.log(`[PROCESS-PREMIUM-PDF] Thumbnail uploaded: ${coverImageUrl}`);
      }
    } catch (thumbError) {
      console.error(`[PROCESS-PREMIUM-PDF] Error generating thumbnail:`, thumbError);
      // Continue without thumbnail
    }

    // Atualizar registro do livro
    const updateData: any = {
      total_pages: pdfData.numpages,
      extracted_text: extractedText,
      updated_at: new Date().toISOString(),
    };
    
    if (coverImageUrl) {
      updateData.cover_image_url = coverImageUrl;
    }
    
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
        totalPages: pdfData.numpages,
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
