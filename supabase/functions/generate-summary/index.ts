import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const generateSummaryInputSchema = z.object({
  bookId: z.string().uuid({ message: "Invalid book ID" }),
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
    const validation = generateSummaryInputSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      throw new Error(validation.error.errors[0].message);
    }

    const { bookId } = validation.data;

    // Get book with extracted text
    const { data: book, error: bookError } = await supabaseClient
      .from('books')
      .select('extracted_text, title, author')
      .eq('id', bookId)
      .eq('user_id', userData.user.id)
      .single();

    if (bookError) {
      console.error('Book fetch error:', bookError);
      throw new Error('Book not found');
    }

    if (!book.extracted_text) {
      throw new Error('No extracted text available for this book');
    }

    // Call Lovable AI to generate summary
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating summary for book:', bookId);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, insightful summaries of book content. Focus on main themes, key points, and important takeaways. Keep summaries clear and engaging.'
          },
          {
            role: 'user',
            content: `Please create a comprehensive summary of the following book content. Include the main themes, key points, and important insights.\n\nTitle: ${book.title || 'Unknown'}\nAuthor: ${book.author || 'Unknown'}\n\nContent:\n${book.extracted_text.slice(0, 50000)}` // Limit to first 50k chars to avoid token limits
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to continue.');
      }
      throw new Error('Failed to generate summary');
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated');
    }

    console.log('Summary generated successfully, updating book...');

    // Update book with generated summary
    const { error: updateError } = await supabaseClient
      .from('books')
      .update({ summary })
      .eq('id', bookId)
      .eq('user_id', userData.user.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    console.log('Book updated with summary');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Summary generated successfully',
        summary 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error generating summary:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});