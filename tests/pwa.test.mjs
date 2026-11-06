import { readFile, access } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'

test('production service worker precaches the shell and ignores external requests', async () => {
  const source = await readFile('dist/sw.js', 'utf8')
  const handlers = {}
  let precached = []
  const cache = { addAll: async files => { precached = files; await Promise.all(files.map(file => access(`dist/${file.slice(2)}`))) }, match: async () => 'cached shell' }
  const self = { location: { origin: 'https://example.test' }, registration: { scope: 'https://example.test/the-one-ring/' }, addEventListener: (name, callback) => { handlers[name] = callback } }
  const caches = { open: async () => cache, keys: async () => [], delete: async () => true }
  vm.runInNewContext(source, { self, caches, URL, fetch: () => { throw new Error('network should not be used') } })
  let installing
  handlers.install({ waitUntil: promise => { installing = promise } })
  await installing
  assert.ok(precached.includes('./index.html'))
  assert.ok(precached.some(file => file.endsWith('.js')))
  assert.ok(precached.includes('./icon-192.png'))
  let response
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/the-one-ring/', mode: 'navigate' }, respondWith: value => { response = value } })
  assert.equal(await response, 'cached shell')
  let intercepted = false
  handlers.fetch({ request: { method: 'GET', url: 'https://example.supabase.co/auth/v1/user', mode: 'cors' }, respondWith: () => { intercepted = true } })
  assert.equal(intercepted, false)
})
