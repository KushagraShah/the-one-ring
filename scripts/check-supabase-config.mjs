// This runs in CI before the build, without printing configuration values.
const url = process.env.VITE_SUPABASE_URL?.trim()
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Set them as repository variables or secrets.')
  process.exit(1)
}

try {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error()
} catch {
  console.error('VITE_SUPABASE_URL must be an HTTPS project URL without credentials, a path, query, or fragment.')
  process.exit(1)
}

if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
  console.error('VITE_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key (sb_publishable_…). Never use a secret, service-role, or legacy key here.')
  process.exit(1)
}
