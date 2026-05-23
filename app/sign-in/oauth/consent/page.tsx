'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConsentPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <p style={{ color: 'var(--clr-navy)', fontWeight: 600 }}>Loading...</p>
      </div>
    }>
      <ConsentContent />
    </Suspense>
  )
}

function ConsentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const authorizationId = searchParams.get('authorization_id')

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [details, setDetails] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      if (!authorizationId) {
        setError('No valid authorization ID provided.')
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/sign-in?next=${encodeURIComponent(window.location.href)}`)
        return
      }
      setUser(user)

      try {
        const res = await fetch(`/api/oauth/details?authorization_id=${authorizationId}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Error fetching authorization details.')
        } else {
          setDetails(data)
        }
      } catch {
        setError('Connection error. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [authorizationId, router, supabase])

  const handleAction = async (action: 'approve' | 'deny') => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/oauth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_id: authorizationId, action }),
      })

      const data = await res.json()
      console.log('[Consent page] API response:', data)

      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status})`)
      }

      // Handle both snake_case and camelCase variants from the server
      const redirectUrl = data.redirect_to || data.redirectto || data.redirectUrl
      if (!redirectUrl) {
        throw new Error('Server did not return a redirect URL.')
      }

      window.location.assign(redirectUrl)
    } catch (err: any) {
      console.error('[Consent page] Action failed:', err)
      setError(err.message)
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', padding: '1rem' }}>
      <div style={{ maxWidth: '500px', width: '100%', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, var(--clr-navy), #2c3e50)', padding: '2rem', textAlign: 'center', color: 'white' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>OCGC Identity</h1>
        </div>

        <div style={{ padding: '2rem' }}>
          {error ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#e11d48', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</p>
              <button
                onClick={() => setError(null)}
                style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--clr-navy)', color: 'white', cursor: 'pointer', marginRight: '0.5rem' }}
              >
                Retry
              </button>
              <button
                onClick={() => router.push('/')}
                style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid var(--clr-border)', backgroundColor: 'transparent', cursor: 'pointer' }}
              >
                Go home
              </button>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', color: 'var(--clr-navy)', marginBottom: '0.5rem' }}>
                  {details?.client_name || 'External Application'}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--clr-navy-md)' }}>
                  is requesting access to your account
                </p>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--clr-border)' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {(details?.scopes || ['email', 'profile']).map((scope: string) => (
                    <li key={scope} style={{ fontSize: '0.85rem', color: 'var(--clr-navy)', marginBottom: '0.4rem' }}>
                      <span style={{ color: '#10b981' }}>✓</span> {scope}
                    </li>
                  ))}
                </ul>
              </div>

              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--clr-navy-md)', marginBottom: '1.5rem' }}>
                Signed in as <strong>{user?.email}</strong>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={actionLoading}
                  style={{ padding: '1rem', borderRadius: '10px', backgroundColor: 'var(--clr-navy)', color: 'white', fontWeight: 700, border: 'none', cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}
                >
                  {actionLoading ? 'Processing...' : 'Authorize'}
                </button>
                <button
                  onClick={() => handleAction('deny')}
                  disabled={actionLoading}
                  style={{ padding: '1rem', borderRadius: '10px', backgroundColor: 'transparent', color: 'var(--clr-navy-md)', fontWeight: 600, border: '1px solid var(--clr-border)', cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
