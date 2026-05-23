import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * CRITICAL PROXY: OAuth 2.1 entry point for external applications.
 *
 * WHY THIS PROXY EXISTS:
 * Supabase requires the /authorize call to include the user's Bearer token
 * so the authorization_id gets linked to their session. Without this, the
 * authorization_id is created anonymously and Supabase returns validation_failed
 * on the consent screen, making it impossible to complete the flow.
 *
 * FLOW:
 * 1. External app redirects here with client_id, code_challenge, etc.
 * 2. If no session: save params and redirect to /sign-in
 * 3. If session: call Supabase /authorize with Bearer token (server-to-server)
 * 4. Supabase responds 307 redirecting back here with ?authorization_id=XXX
 * 5. Detect authorization_id-only request and redirect to consent screen
 *
 * REQUIRED CONFIGURATION IN SECONDARY APP:
 * The OAuth authorization endpoint must point to THIS proxy:
 *   https://<your-app>.vercel.app/api/oauth/authorize
 * NOT to: https://<ref>.supabase.co/auth/v1/oauth/authorize
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  // STEP 5: Supabase redirected back here with only authorization_id.
  // This means Supabase already processed the authorize request and linked
  // the authorization_id to the user session. Redirect to consent screen.
  const authorizationId = searchParams.get('authorization_id')
  if (authorizationId && !searchParams.get('client_id')) {
    const consentUrl = new URL('/sign-in/oauth/consent', request.url)
    consentUrl.searchParams.set('authorization_id', authorizationId)
    console.log('[OAuth Proxy] Received authorization_id from Supabase, redirecting to consent:', authorizationId)
    return NextResponse.redirect(consentUrl)
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
  const oauthParams = searchParams.toString()

  if (!session) {
    // No session: save OAuth params and redirect to login.
    // After login, sign-in redirects back here with the same params
    // and this time there WILL be a session to call Supabase with Bearer token.
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('next', `/api/oauth/authorize?${oauthParams}`)
    console.log('[OAuth Proxy] No session — redirecting to sign-in. Params saved:', oauthParams)
    return NextResponse.redirect(signInUrl)
  }

  // With session: build the Supabase /authorize URL with the same params
  const authorizeUrl = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/oauth/authorize`)
  searchParams.forEach((value, key) => {
    authorizeUrl.searchParams.set(key, value)
  })

  console.log('[OAuth Proxy] User:', session.user.email, '— Calling Supabase authorize with Bearer token')

  // Call Supabase /authorize server-to-server with Bearer token.
  // Supabase will link the authorization_id to the authenticated user.
  const response = await fetch(authorizeUrl.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    redirect: 'manual',
  })

  const location = response.headers.get('location') || ''

  console.log('[OAuth Proxy] Supabase status:', response.status, '— Location:', location)

  if (!location) {
    const body = await response.text()
    console.error('[OAuth Proxy] No location header. Body:', body)
    return NextResponse.json(
      { error: 'Supabase did not return a redirect URL', status: response.status, body },
      { status: 502 }
    )
  }

  // If Supabase redirects to sign-in, it did not accept the Bearer token
  if (location.includes('/sign-in') || location.includes('sign_in')) {
    console.error('[OAuth Proxy] Supabase rejected the Bearer token and redirected to sign-in')
    return NextResponse.json(
      { error: 'Supabase did not accept the Bearer token in /authorize. Check the OAuth client configuration.' },
      { status: 502 }
    )
  }

  // Success: redirect the user to where Supabase says (usually back here with authorization_id)
  console.log('[OAuth Proxy] Redirecting to:', location)
  return NextResponse.redirect(location)
}
