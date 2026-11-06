import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

function validate(url, key) {
  const env = { ...process.env }
  delete env.VITE_SUPABASE_URL
  delete env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (url !== undefined) env.VITE_SUPABASE_URL = url
  if (key !== undefined) env.VITE_SUPABASE_PUBLISHABLE_KEY = key
  return spawnSync(process.execPath, ['scripts/check-supabase-config.mjs'], { env, encoding: 'utf8' })
}

test('rejects missing configuration', () => {
  assert.equal(validate(undefined, undefined).status, 1)
})

test('accepts an https project URL and publishable key', () => {
  assert.equal(validate('https://example.supabase.co', 'sb_publishable_example-key').status, 0)
})

test('rejects insecure or credential-bearing URLs', () => {
  for (const url of ['http://example.supabase.co', 'https://user:password@example.supabase.co', 'https://example.supabase.co/path']) {
    assert.equal(validate(url, 'sb_publishable_example').status, 1)
  }
})

test('rejects secret and legacy keys without echoing them', () => {
  for (const key of ['sb_secret_not-for-clients', 'eyJhbGciOiJIUzI1NiJ9.secret']) {
    const result = validate('https://example.supabase.co', key)
    assert.equal(result.status, 1)
    assert.ok(!result.stdout.includes(key) && !result.stderr.includes(key))
  }
})
