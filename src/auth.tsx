import { useEffect, useState } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

function createConfiguredClient() {
  if (!url || !key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null
    return createClient(url, key)
  } catch {
    return null
  }
}

export const supabase = createConfiguredClient()

export function AuthGate({ children }: { children: (identity: { id: string; email: string; demo: boolean; username: string; avatar: string }, signOut: () => void) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [demo, setDemo] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) { setSession(data.session); setLoading(false); if (error) setMessage(error.message) }
    }).catch(() => { if (active) { setMessage('Unable to load your session. Please try again.'); setLoading(false) } })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setLoading(false) } })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) { setMessage('Enter a valid email and a password of at least 6 characters. A username is required for sign-up.'); return }
    setBusy(true); setMessage('')
    try {
      if (!supabase) throw new Error('Supabase is not configured. See docs/setup.md.')
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const name = username.trim()
        if (!name || name.length > 40) throw new Error('Enter a username of up to 40 characters.')
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username: name, avatar: 'circle' }, emailRedirectTo: new URL('.', window.location.href).href } })
        if (error) throw error
        if (!data.session) { setVerificationSent(true); setPassword('') }
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to connect. Please try again.') }
    finally { setBusy(false) }
  }

  if (loading) return <main className="auth-page" data-theme="neutral"><p>Loading your space…</p></main>
  if (demo) return <>{children({ id: 'demo', email: 'Demo user', demo: true, username: 'Demo user', avatar: 'circle' }, () => setDemo(false))}</>
  if (session && supabase) return <>{children({ id: session.user.id, email: session.user.email || 'Your account', demo: false, username: typeof session.user.user_metadata?.username === 'string' ? session.user.user_metadata.username : '', avatar: typeof session.user.user_metadata?.avatar === 'string' ? session.user.user_metadata.avatar : 'circle' }, () => { void supabase.auth.signOut() })}</>
  if (verificationSent) return <main className="auth-page" data-theme="neutral"><div className="auth-card"><div className="auth-brand"><span className="brand-mark"><span/></span> the one ring</div><h1>Check your email.</h1><p>If this address can be registered, a verification link has been sent to <strong>{email}</strong>. Open the link to verify your email, then sign in.</p><button className="primary wide" onClick={() => { setVerificationSent(false); setMode('signin'); setMessage('') }}>Back to sign in</button></div></main>
  return <main className="auth-page" data-theme="neutral"><div className="auth-card"><div className="auth-brand"><span className="brand-mark"><span/></span> the one ring</div><p className="auth-kicker">YOUR PERSONAL APP SPACE</p><h1>{mode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h1><p>One place for the little things you do every day.</p>{supabase ? <><form noValidate onSubmit={submit} className="auth-form">{mode === 'signup' && <label>Username<input autoComplete="nickname" required maxLength={40} value={username} onChange={e => setUsername(e.target.value)}/></label>}<label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)}/></label>{mode === 'signup' && <p className="auth-message">You may need to verify your email before signing in.</p>}{message && <p role="status" className="auth-message">{message}</p>}<button className="primary wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}</button></form><button className="auth-switch" disabled={busy} onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>{mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button><div className="auth-divider"><span>OR</span></div></> : <p role="alert" className="auth-message config-error">Sign-in is unavailable: this build has missing or invalid Supabase configuration. See docs/setup.md. Demo mode is still available.</p>}<button className="outline-button wide" onClick={() => setDemo(true)}>Explore the demo</button><p className="auth-footnote">Demo data resets on refresh. Account data requires an internet connection.</p></div></main>
}
