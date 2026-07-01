import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { captureEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityAlert {
  type: 'rate_limit_violation' | 'high_volume_ip' | 'suspicious_pattern';
  userId?: string;
  ipAddress?: string;
  details: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    // Require authentication: either a valid user JWT or an internal shared secret
    const authHeader = req.headers.get('Authorization') ?? '';
    const internalSecret = Deno.env.get('INTERNAL_ALERT_SECRET');
    const providedToken = authHeader.replace('Bearer ', '').trim();

    let authorized = false;

    if (internalSecret && providedToken && providedToken === internalSecret) {
      authorized = true;
    } else if (providedToken) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(providedToken);
      if (!authError && user) {
        // Only allow admins to manually dispatch alerts
        const { data: roles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin');
        if (roles && roles.length > 0) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { alert }: { alert: SecurityAlert } = await req.json();

    console.log(`[SECURITY-ALERT] Processing alert: ${alert.type}`);

    // Get admin emails
    const { data: adminRoles } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    const adminIds = (adminRoles || []).map(r => r.user_id);
    
    const { data: adminProfiles } = await supabaseClient
      .from('profiles')
      .select('email')
      .in('id', adminIds);

    const adminEmails = (adminProfiles || []).map(p => p.email).filter(Boolean);

    // Format alert message
    const alertTitle = getAlertTitle(alert.type);
    const alertMessage = formatAlertMessage(alert);

    // Send email notifications
    if (adminEmails.length > 0) {
      await sendEmailAlert(adminEmails, alertTitle, alertMessage);
    }

    // Send Slack notification
    await sendSlackAlert(alertTitle, alertMessage, alert);

    console.log(`[SECURITY-ALERT] Notifications sent successfully`);

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    captureEdgeError(error, { function: "send-security-alert" });
    console.error('[SECURITY-ALERT] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function getAlertTitle(type: string): string {
  const titles: Record<string, string> = {
    'rate_limit_violation': '🚨 Rate Limit Violation Detected',
    'high_volume_ip': '⚠️ High Volume Access from Single IP',
    'suspicious_pattern': '🔍 Suspicious Activity Pattern Detected',
  };
  return titles[type] || '🔔 Security Alert';
}

function formatAlertMessage(alert: SecurityAlert): string {
  const { type, userId, ipAddress, details } = alert;
  
  let message = `**Alert Type:** ${type}\n\n`;
  
  if (userId) {
    message += `**User ID:** ${userId}\n`;
  }
  
  if (ipAddress) {
    message += `**IP Address:** ${ipAddress}\n`;
  }
  
  message += `\n**Details:**\n`;
  
  for (const [key, value] of Object.entries(details)) {
    message += `- ${key}: ${JSON.stringify(value)}\n`;
  }
  
  message += `\n**Timestamp:** ${new Date().toISOString()}`;
  
  return message;
}

async function sendEmailAlert(
  emails: string[], 
  title: string, 
  message: string
): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.warn('[SECURITY-ALERT] RESEND_API_KEY not configured, skipping email');
    return;
  }

  const resend = new Resend(resendApiKey);
  
  try {
    await resend.emails.send({
      from: 'Security Alerts <onboarding@resend.dev>',
      to: emails,
      subject: title,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #dc2626; margin-top: 0;">${title}</h1>
              <div style="background: #fef2f2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0;">
                <p style="margin: 0; color: #991b1b;">A security event has been detected in your application.</p>
              </div>
              <div style="white-space: pre-wrap; font-size: 14px; color: #374151;">
                ${message.replace(/\*\*/g, '<strong>').replace(/\n/g, '<br>')}
              </div>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280; margin: 0;">
                  This is an automated security alert. Please review your audit logs for more details.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    
    console.log(`[SECURITY-ALERT] Email sent to ${emails.length} admin(s)`);
  } catch (error) {
    captureEdgeError(error, { function: "send-security-alert" });
    console.error('[SECURITY-ALERT] Email error:', error);
  }
}

async function sendSlackAlert(
  title: string, 
  message: string, 
  alert: SecurityAlert
): Promise<void> {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  if (!webhookUrl) {
    console.warn('[SECURITY-ALERT] SLACK_WEBHOOK_URL not configured, skipping Slack');
    return;
  }

  try {
    const color = alert.type === 'rate_limit_violation' ? 'danger' : 'warning';
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title,
          text: message,
          footer: 'Security Monitoring System',
          ts: Math.floor(Date.now() / 1000),
          fields: [
            {
              title: 'User ID',
              value: alert.userId || 'N/A',
              short: true,
            },
            {
              title: 'IP Address',
              value: alert.ipAddress || 'N/A',
              short: true,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }
    
    console.log('[SECURITY-ALERT] Slack notification sent');
  } catch (error) {
    captureEdgeError(error, { function: "send-security-alert" });
    console.error('[SECURITY-ALERT] Slack error:', error);
  }
}
