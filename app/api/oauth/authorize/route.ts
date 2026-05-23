import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * CRITICAL PROXY: OAuth 2.1 entry point for external applications.
 *
 * WHY THIS PROXY EXISTS:
 * Supabase requires the /authorize call to arrive WITH the user's session cookies
 * so the authorization_id gets linked to their account. A server-to-server fetch
 * with a Bearer token does NOT work — Supabase uses browser cookies (sb-*-auth-token)
 * to identify the user on this endpoint, not the Authorization header.
 *
 * FLOW:
 * 1. External app redirects here with client_id, code_challenge, etc.
 * 2. If no session: save params and redirect to /sign-in
 * 3. If session: redirect the BROWSER to Supabase /authorize (cookies travel with it)
 * 4. Supabase links the authorization_id to the authenticated user and redirects
 *    back here with ?authorization_id=XXX
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
  // The authorization_id is now linked to the authenticated user.
  // Redirect to the consent screen.
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
    // After login, /sign-in redirects back here with the same params
    // and this time there WILL be a session.
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('next', `/api/oauth/authorize?${oauthParams}`)
    console.log('[OAuth Proxy] No session — redirecting to sign-in. Params saved:', oauthParams)
    return NextResponse.redirect(signInUrl)
  }

  // STEP 3: Session exists. Redirect the BROWSER (not a server fetch) to Supabase /authorize.
  // This is critical: the browser carries its own sb-*-auth-token cookies,
  // which Supabase uses to link the authorization_id to the authenticated user.
  // A server-to-server fetch with Bearer token does NOT achieve this.
  const authorizeUrl = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/oauth/authorize`)
  searchParams.forEach((value, key) => {
    authorizeUrl.searchParams.set(key, value)
  })

  console.log('[OAuth Proxy] Session found for', session.user.email, '— redirecting browser to Supabase:', authorizeUrl.toString())

  return NextResponse.redirect(authorizeUrl.toString())
}
