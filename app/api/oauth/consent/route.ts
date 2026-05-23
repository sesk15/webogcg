import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Processes approval or denial of an OAuth authorization.
 * Accepts all naming conventions for authorization_id:
 *   - authorization_id  (snake_case — canonical, from authorize/route.ts)
 *   - authorizationId   (camelCase)
 *   - authorizationid   (lowercase — sent by the consent page UI)
 * Supabase /auth/v1/oauth/authorizations/:id/consent expects { action: 'approve' | 'deny' }.
 * Supabase returns { redirect_url: "..." } on success.
 * We normalize this to { redirect_to: "..." } for the client.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Accept all naming conventions from the client
    const authorizationId =
      body.authorization_id ||
      body.authorizationId ||
      body.authorizationid

    const action = body.action || 'approve'

    if (!authorizationId) {
      return NextResponse.json({ error: 'Missing authorizationId' }, { status: 400 })
    }

    if (action !== 'approve' && action !== 'deny') {
      return NextResponse.json({ error: "action must be 'approve' or 'deny'" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'No authenticated session' }, { status: 401 })
    }

    // Supabase expects { action: 'approve' | 'deny' }
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/oauth/authorizations/${authorizationId}/consent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ action }),
      }
    )

    const data = await res.json()
    console.log('[OAuth Consent] Supabase raw response:', JSON.stringify(data))

    if (!res.ok) {
      console.error('[OAuth Consent] Error from Supabase:', data)
      return NextResponse.json(
        { error: data.msg || data.message || 'Error processing consent', details: data },
        { status: res.status }
      )
    }

    // Supabase returns redirect_url — also handle other variants for robustness
    const redirectUrl =
      data.redirect_url ||
      data.redirect_to ||
      data.redirect_uri ||
      data.redirectTo ||
      data.redirectUrl ||
      data.url ||
      null

    if (!redirectUrl) {
      console.error('[OAuth Consent] No redirect URL in Supabase response:', data)
      return NextResponse.json(
        { error: 'Supabase did not return a redirect URL', details: data },
        { status: 502 }
      )
    }

    return NextResponse.json({ redirect_to: redirectUrl })

  } catch (err: any) {
    console.error('[OAuth Consent] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
