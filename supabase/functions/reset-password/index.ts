import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ResetPasswordRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate password reset link — use a server-controlled base URL
    // to prevent open-redirect/phishing via attacker-supplied Origin header.
    const allowedOrigins = [
      Deno.env.get("APP_BASE_URL"),
      "https://aura-read-vision.lovable.app",
    ].filter(Boolean) as string[];

    const requestOrigin = req.headers.get("origin") ?? "";
    const baseUrl = allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : (Deno.env.get("APP_BASE_URL") ?? "https://aura-read-vision.lovable.app");

    const redirectTo = `${baseUrl}/reset-password`;
    const { data, error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send email with Resend
    const emailResponse = await resend.emails.send({
      from: "AURA READ <onboarding@resend.dev>",
      to: [email],
      subject: "Recuperação de Senha - AURA READ",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(251, 146, 60, 0.1)); border-radius: 16px; padding: 40px; border: 1px solid rgba(139, 92, 246, 0.2);">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #8b5cf6; font-size: 32px; margin: 0 0 10px 0;">AURA READ</h1>
                  <p style="color: #a0a0a0; font-size: 14px; margin: 0;">Sua biblioteca pessoal interativa</p>
                </div>
                
                <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px 0; text-align: center;">Recuperação de Senha</h2>
                
                <p style="color: #d0d0d0; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                  Recebemos uma solicitação para redefinir a senha da sua conta AURA READ. 
                  Clique no botão abaixo para criar uma nova senha:
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.properties.action_link}" 
                     style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #fb923c); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
                    Redefinir Senha
                  </a>
                </div>
                
                <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
                  Este link expira em 1 hora. Se você não solicitou a recuperação de senha, 
                  pode ignorar este email com segurança.
                </p>
                
                <p style="color: #808080; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
                  © 2024 AURA READ. Todos os direitos reservados.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Error sending email:", emailResponse.error);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Password reset email sent successfully to:", email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email de recuperação enviado com sucesso" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in reset-password function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
