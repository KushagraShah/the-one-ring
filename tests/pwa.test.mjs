import { readFile, access } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'

test('production service worker precaches the shell and ignores external requests', async () => {
  const source = await readFile('dist/sw.js', 'utf8')
  const handlers = {}
  let precached = []
  const cache = { addAll: async files => { precached = files; await Promise.all(files.map(file => access(`dist/${new URL(file.url).pathname.replace('/the-one-ring/', '')}`))) }, match: async () => 'cached shell' }
  let skipped = 0
  const self = { location: { origin: 'https://example.test' }, registration: { scope: 'https://example.test/the-one-ring/' }, skipWaiting: () => { skipped++ }, addEventListener: (name, callback) => { handlers[name] = callback } }
  const caches = { open: async () => cache, keys: async () => [], delete: async () => true }
  vm.runInNewContext(source, { self, caches, URL, Request, fetch: () => { throw new Error('network should not be used') } })
  let installing
  handlers.install({ waitUntil: promise => { installing = promise } })
  await installing
  assert.ok(precached.some(file => file.url.endsWith('/index.html')))
  assert.ok(precached.some(file => file.url.endsWith('.js')))
  assert.ok(precached.some(file => file.url.endsWith('/icon-192.png')))
  assert.ok(precached.every(file => file.cache === 'reload'))
  handlers.message({ data: { type: 'OTHER' } })
  assert.equal(skipped, 0)
  handlers.message({ data: { type: 'SKIP_WAITING' } })
  assert.equal(skipped, 1)
  let response
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/the-one-ring/', mode: 'navigate' }, respondWith: value => { response = value } })
  assert.equal(await response, 'cached shell')
  let intercepted = false
  handlers.fetch({ request: { method: 'GET', url: 'https://example.supabase.co/auth/v1/user', mode: 'cors' }, respondWith: () => { intercepted = true } })
  assert.equal(intercepted, false)
})
