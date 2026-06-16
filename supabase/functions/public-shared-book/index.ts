// Public endpoint: resolve a share token into book metadata + signed PDF URL.
// Anyone with a valid (non-expired) token can read.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || token.length < 8 || token.length > 128) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: share, error: shareErr } = await supabase
      .from("book_shares")
      .select("book_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (shareErr || !share) {
      return new Response(JSON.stringify({ error: "Link não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(share.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Link expirado" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: book, error: bookErr } = await supabase
      .from("books")
      .select("id, title, author, total_pages, cover_image_url, cover_color, file_path")
      .eq("id", share.book_id)
      .maybeSingle();

    if (bookErr || !book) {
      return new Response(JSON.stringify({ error: "Livro não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let pdfUrl: string | null = null;
    if (book.file_path) {
      const { data: signed, error: signErr } = await supabase.storage
        .from("pdfs")
        .createSignedUrl(book.file_path, 60 * 60); // 1h
      if (!signErr) pdfUrl = signed?.signedUrl ?? null;
    }

    return new Response(
      JSON.stringify({
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          total_pages: book.total_pages,
          cover_image_url: book.cover_image_url,
          cover_color: book.cover_color,
        },
        pdfUrl,
        expiresAt: share.expires_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("[public-shared-book] error", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
