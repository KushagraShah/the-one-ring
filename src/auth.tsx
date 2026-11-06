import { useEffect, useState } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://zzhulojslsnuraaffzfi.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_tilDLVO5i3B-ZV19AwKvxQ_xb_-T1WH'
export const supabase = createClient(url, key)

export function AuthGate({ children }: { children: (identity: { id: string; email: string; demo: boolean }, signOut: () => void) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [demo, setDemo] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoading(false) } })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setLoading(false) } })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL('.', window.location.href).href } })
        if (error) throw error
        if (!data.session) setMessage('Check your email for a confirmation link, then sign in.')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to connect. Please try again.') }
    finally { setBusy(false) }
  }

  if (loading) return <main className="auth-page"><p>Loading your space…</p></main>
  if (demo) return <>{children({ id: 'demo', email: 'Demo user', demo: true }, () => setDemo(false))}</>
  if (session) return <>{children({ id: session.user.id, email: session.user.email || 'Your account', demo: false }, () => { void supabase.auth.signOut() })}</>
  return <main className="auth-page"><div className="auth-card"><div className="auth-brand"><span className="brand-mark"><span/></span> the one ring</div><p className="auth-kicker">YOUR PERSONAL APP SPACE</p><h1>{mode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h1><p>One place for the little things you do every day.</p><form onSubmit={submit} className="auth-form"><label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)}/></label>{message && <p role="status" className="auth-message">{message}</p>}<button className="primary wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}</button></form><button className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>{mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button><div className="auth-divider"><span>OR</span></div><button className="outline-button wide" onClick={() => setDemo(true)}>Explore the demo</button><p className="auth-footnote">Demo data stays in this browser. Account data is local only until cloud sync is available.</p></div></main>
}
