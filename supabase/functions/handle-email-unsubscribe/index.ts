import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const url = new URL(req.url)
  let token: string | null = url.searchParams.get('token')
  let preferences:
    | { ads?: boolean; content?: boolean; product_updates?: boolean }
    | null = null
  let isOneClick = false

  if (req.method === 'POST') {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formText = await req.text()
      const params = new URLSearchParams(formText)
      if (params.get('List-Unsubscribe') === 'One-Click') {
        isOneClick = true
      } else {
        const formToken = params.get('token')
        if (formToken) token = formToken
      }
    } else {
      try {
        const body = await req.json()
        if (body.token) token = body.token
        if (body.preferences && typeof body.preferences === 'object') {
          preferences = {
            ads: !!body.preferences.ads,
            content: !!body.preferences.content,
            product_updates: !!body.preferences.product_updates,
          }
        }
      } catch {
        // ignore
      }
    }
  }


  if (!token) {
    return jsonResponse({ error: 'Token is required' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: tokenRecord, error: lookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (lookupError || !tokenRecord) {
    return jsonResponse({ error: 'Invalid or expired token' }, 404)
  }

  const emailLower = String(tokenRecord.email).toLowerCase()

  // Always return current preferences for the page
  const { data: prefs } = await supabase
    .from('email_preferences')
    .select('ads, content, product_updates')
    .eq('email', emailLower)
    .maybeSingle()

  const currentPrefs = {
    ads: prefs?.ads ?? true,
    content: prefs?.content ?? true,
    product_updates: prefs?.product_updates ?? true,
  }

  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('email')
    .eq('email', emailLower)
    .maybeSingle()

  if (req.method === 'GET') {
    return jsonResponse({
      valid: true,
      email: tokenRecord.email,
      already_unsubscribed: !!suppressed,
      preferences: currentPrefs,
    })
  }

  // POST — granular preferences flow
  if (preferences && !isOneClick) {
    const nextPrefs = {
      email: emailLower,
      ads: preferences.ads ?? true,
      content: preferences.content ?? true,
      product_updates: preferences.product_updates ?? true,
      marketing: !!(preferences.ads || preferences.content),
      updated_at: new Date().toISOString(),
    }
    const { error: upsertErr } = await supabase
      .from('email_preferences')
      .upsert(nextPrefs, { onConflict: 'email' })
    if (upsertErr) {
      console.error('prefs upsert failed', upsertErr)
      return jsonResponse({ error: 'Failed to save preferences' }, 500)
    }

    const allOff = !nextPrefs.ads && !nextPrefs.content && !nextPrefs.product_updates
    if (allOff) {
      await supabase
        .from('suppressed_emails')
        .upsert({ email: emailLower, reason: 'unsubscribe' }, { onConflict: 'email' })
      await supabase
        .from('email_unsubscribe_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token)
        .is('used_at', null)
    } else if (suppressed) {
      await supabase.from('suppressed_emails').delete().eq('email', emailLower)
    }

    return jsonResponse({
      success: true,
      preferences: {
        ads: nextPrefs.ads,
        content: nextPrefs.content,
        product_updates: nextPrefs.product_updates,
      },
      fully_unsubscribed: allOff,
    })
  }


  // Legacy / one-click full unsubscribe
  if (tokenRecord.used_at && suppressed) {
    return jsonResponse({ success: false, reason: 'already_unsubscribed' })
  }

  const { data: updated, error: updateError } = await supabase
    .from('email_unsubscribe_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .select()
    .maybeSingle()

  if (updateError) {
    console.error('Failed to mark token as used', updateError)
    return jsonResponse({ error: 'Failed to process unsubscribe' }, 500)
  }

  if (!updated && !suppressed) {
    return jsonResponse({ success: false, reason: 'already_unsubscribed' })
  }

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      { email: emailLower, reason: 'unsubscribe' },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to suppress email', suppressError)
    return jsonResponse({ error: 'Failed to process unsubscribe' }, 500)
  }

  await supabase
    .from('email_preferences')
    .upsert(
      { email: emailLower, marketing: false, product_updates: false, updated_at: new Date().toISOString() },
      { onConflict: 'email' },
    )

  return jsonResponse({ success: true, fully_unsubscribed: true })
})
