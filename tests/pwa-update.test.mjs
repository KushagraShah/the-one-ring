import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

test('a waiting production worker announces an update without discarding demo data', { timeout: 60000 }, async () => {
  let revision = 1
  const server = createServer(async (request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname.replace(/^\//, '') || 'index.html'
    if (name.includes('..')) { response.writeHead(400).end(); return }
    try {
      const data = await readFile(`dist/${name}`)
      const type = name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'application/octet-stream'
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
      response.end(name === 'sw.js' ? `${data}\n// test revision ${revision}` : data)
    } catch { response.writeHead(404).end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.setDefaultTimeout(10000)
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    await page.getByRole('button', { name: 'Explore the demo' }).click()
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await page.getByRole('button', { name: 'Explore the demo' }).click()
    revision++
    await page.evaluate(async () => { const worker = await navigator.serviceWorker.ready; await worker.update() })
    await page.getByText('An update is available').waitFor()
    await page.getByRole('button', { name: 'Update app' }).click()
    await page.getByText('Exit demo mode before updating', { exact: false }).waitFor()
    assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting), true)
    assert.equal(await page.getByText('An update is available').count(), 1)
  } finally {
    await browser.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})

test('a new worker installs a fresh shell despite a cached older build', { timeout: 60000 }, async () => {
  const html = await readFile('dist/index.html', 'utf8')
  const source = await readFile('dist/sw.js', 'utf8')
  const { version } = JSON.parse(await readFile('package.json', 'utf8'))
  const previousVersion = '0.0.0-test-previous'
  const asset = html.match(/assets\/[^"\s]+\.js/)?.[0]
  assert.ok(asset, 'production JavaScript asset exists')
  const js = await readFile(`dist/${asset}`, 'utf8')
  assert.ok(js.includes(version), 'production bundle contains current version')
  let revision = 1
  const indexRequests = []
  let releaseIndex
  const delayedIndex = new Promise(resolve => { releaseIndex = resolve })
  let indexRequested
  const newIndexRequested = new Promise(resolve => { indexRequested = resolve })
  const server = createServer(async (request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname.replace(/^\//, '') || 'index.html'
    if (name.includes('..')) { response.writeHead(400).end(); return }
    try {
      let data
      if (name === 'index.html') {
        indexRequests.push({ revision, cache: request.headers['cache-control'] || '' })
        if (revision === 2) { indexRequested(); await delayedIndex }
        data = html.replace(asset, `assets/test-build-${revision}.js`)
      } else if (name === 'sw.js') {
        data = source.replace(asset, `assets/test-build-${revision}.js`).replace(/const CACHE = CACHE_PREFIX \+ [^;]+;/, `const CACHE = CACHE_PREFIX + 'test-build-${revision}';`)
        // The previous build used normal cacheable precache requests.
        if (revision === 1) data = data.replace("FILES.map(file => new Request(new URL(file, self.registration.scope), { cache: 'reload' }))", 'FILES')
      } else if (name === 'assets/test-build-1.js') data = js.replaceAll(version, previousVersion)
      else if (name === 'assets/test-build-2.js') data = js
      else data = await readFile(`dist/${name}`)
      const type = name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'application/octet-stream'
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': name === 'sw.js' ? 'no-store' : 'public, max-age=600' })
      response.end(data)
    } catch { response.writeHead(404).end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.setDefaultTimeout(10000)
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    await page.getByRole('button', { name: 'Explore the demo' }).click()
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await page.getByRole('button', { name: 'Explore the demo' }).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
    await page.getByText(`The One Ring · v${previousVersion}`).waitFor()
    await page.getByText('No update found.').waitFor()
    revision = 2
    await page.getByRole('button', { name: 'Check for updates' }).click()
    await newIndexRequested
    await page.getByText('Checking for updates…').waitFor()
    assert.equal(await page.getByText('No update found.').count(), 0)
    releaseIndex()
    await page.getByText('An update is available').waitFor()
    assert.ok(indexRequests.some(item => item.revision === 2 && /no-cache|max-age=0/.test(item.cache)), 'new worker revalidates the cached HTML')
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      const changed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      await changed
    })
    await page.reload()
    await page.getByRole('button', { name: 'Explore the demo' }).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
    await page.getByText(`The One Ring · v${version}`).waitFor()
  } finally {
    releaseIndex()
    await browser.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})

test('signed-in update waits for fresh guards, supports retry and respects other tabs', { timeout: 120000 }, async () => {
  // Build an isolated production fixture so this test never depends on deployment credentials.
  const { mkdir, mkdtemp, rm } = await import('node:fs/promises')
  const { build } = await import('vite')
  await mkdir('.tmp', { recursive: true })
  const dir = await mkdtemp('.tmp/pwa-update-')
  const previousUrl = process.env.VITE_SUPABASE_URL
  const previousKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  process.env.VITE_SUPABASE_URL = 'https://mock.invalid'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  let server, browser
  try {
    await build({ build: { outDir: dir, emptyOutDir: false }, logLevel: 'error' })
    const html = await readFile(`${dir}/index.html`, 'utf8')
    const source = await readFile(`${dir}/sw.js`, 'utf8')
    const asset = html.match(/assets\/[^"\s]+\.js/)?.[0]
    assert.ok(asset)
    const js = await readFile(`${dir}/${asset}`, 'utf8')
    const { version } = JSON.parse(await readFile('package.json', 'utf8'))
    const previousVersion = '0.0.0-test-previous'
    let revision = 1
    server = createServer(async (request, response) => {
      const name = new URL(request.url, 'http://localhost').pathname.replace(/^\//, '') || 'index.html'
      if (name.includes('..')) { response.writeHead(400).end(); return }
      try {
        let data
        if (name === 'index.html') data = html.replace(asset, `assets/update-build-${revision}.js`)
        else if (name === 'sw.js') data = source.replace(asset, `assets/update-build-${revision}.js`).replace(/const CACHE = CACHE_PREFIX \+ [^;]+;/, `const CACHE = CACHE_PREFIX + 'update-build-${revision}';`)
        else if (/^assets\/update-build-\d+\.js$/.test(name)) data = name === 'assets/update-build-1.js' ? js.replaceAll(version, previousVersion) : js
        else data = await readFile(`${dir}/${name}`)
        const type = name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'application/octet-stream'
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
        response.end(data)
      } catch { response.writeHead(404).end() }
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const stores = {
      workout: { revision: 0, documents: [] },
      habit: { revision: 0, data: null },
      recipe: { revision: 1, data: { version: 3, recipes: [], shopping: { items: [] }, cooking: null, meta: {}, sides: [], plan: [] } },
    }
    await context.route('https://mock.invalid/**', async route => {
      const request = route.request(); const path = new URL(request.url()).pathname
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      let body
      const rpc = path.match(/tor_online_(workout|habit|recipe)_(read|write)$/)
      if (rpc) {
        const store = stores[rpc[1]]
        if (rpc[2] === 'read') body = store
        else {
          const input = request.postDataJSON()
          if (input.p_revision !== store.revision) body = { status: 'conflict' }
          else {
            store.revision++
            if (rpc[1] === 'workout') store.documents = input.p_documents
            else store.data = input.p_data
            body = { status: 'ok', revision: store.revision }
          }
        }
      }
      else if (path === '/auth/v1/user') body = { id: '10000000-0000-4000-8000-000000000001', email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: { username: 'Tester' } }
      else throw new Error(`Unexpected mock API path: ${path}`)
      await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await context.addInitScript(() => {
      const user = { id: '10000000-0000-4000-8000-000000000001', email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: { username: 'Tester' } }
      const session = { access_token: 'fake-test-token', refresh_token: 'fake-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }
      if (!localStorage.getItem('sb-mock-auth-token')) localStorage.setItem('sb-mock-auth-token', JSON.stringify(session))
      const nativeTimeout = window.setTimeout
      window.setTimeout = (callback, delay, ...args) => nativeTimeout(callback, window.timeoutActivation && delay === 15000 ? 50 : delay, ...args)
      const post = ServiceWorker.prototype.postMessage
      ServiceWorker.prototype.postMessage = function (...args) {
        if (args[0]?.type === 'SKIP_WAITING' && window.failActivation) { window.failActivation = false; throw new Error('test failure') }
        if (args[0]?.type === 'SKIP_WAITING' && window.delayActivation) { window.releaseActivation = () => post.apply(this, args); return }
        return post.apply(this, args)
      }
    })
    const page = await context.newPage(); page.setDefaultTimeout(15000)
    const url = `http://127.0.0.1:${server.address().port}/`
    await page.goto(url)
    await page.evaluate(async () => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
    await page.getByText(`The One Ring · v${previousVersion}`).waitFor()
    await page.getByText('No update found.').waitFor()
    revision++
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
    await page.getByText('An update is available').waitFor()
    // The ordinary, safe path must load the new deployment with one click.
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Update app' }).click()])
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
    await page.getByText(`The One Ring · v${version}`).waitFor()
    await page.getByText('No update found.').waitFor()
    revision++
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
    await page.getByText('An update is available').waitFor()
    await page.evaluate(() => { window.failActivation = true })
    await page.getByRole('button', { name: 'Update app' }).click()
    await page.getByText('Could not activate the update.', { exact: false }).waitFor()
    await page.evaluate(() => { window.delayActivation = true })
    await page.getByRole('button', { name: 'Update app' }).click()
    await page.getByText('Waiting for the update to activate…').waitFor()
    await page.getByLabel('Username').fill('Unsaved draft')
    await page.evaluate(() => window.releaseActivation())
    await page.getByText('Finish or cancel edits', { exact: false }).waitFor()
    assert.equal(await page.getByLabel('Username').inputValue(), 'Unsaved draft')
    await page.getByLabel('Username').fill('Tester')
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Update app' }).click()])
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
    await page.getByText(`The One Ring · v${version}`).waitFor()
    await page.getByText('No update found.').waitFor()

    const openApp = name => page.locator('.app-strip:visible').getByRole('button', { name, exact: true }).click()
    const prepareDelayedUpdate = async () => {
      revision++
      await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
      await page.getByText('An update is available').waitFor()
      await page.evaluate(() => { window.delayActivation = true })
      await page.getByRole('button', { name: 'Update app' }).click()
      await page.getByText('Waiting for the update to activate…').waitFor()
    }
    const finishGuardedUpdate = async () => {
      await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Update app' }).click()])
      await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
      await page.getByText('No update found.').waitFor()
    }

    // An editing screen opened after the first guard must still prevent reload.
    await prepareDelayedUpdate()
    await openApp('Workouts')
    await page.getByRole('button', { name: 'Build routine', exact: true }).click()
    await page.getByLabel('Day name').fill('Protected workout draft')
    await page.evaluate(() => window.releaseActivation())
    await page.getByText('Finish or cancel edits', { exact: false }).waitFor()
    assert.equal(await page.getByLabel('Day name').inputValue(), 'Protected workout draft')
    await page.getByRole('button', { name: 'Update app' }).click()
    assert.equal(await page.getByLabel('Day name').inputValue(), 'Protected workout draft')
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
    await page.getByRole('button', { name: 'Discard and leave' }).click()
    await finishGuardedUpdate()

    // The habit editor is modal, so inspect the status behind it before closing.
    await prepareDelayedUpdate()
    await openApp('Habits')
    await page.getByRole('button', { name: 'Habits', exact: true }).first().click()
    await page.getByRole('button', { name: 'Create habit' }).click()
    await page.getByLabel('Title').fill('Protected habit draft')
    await page.evaluate(() => window.releaseActivation())
    await page.waitForFunction(() => document.querySelector('.app-update')?.textContent.includes('Finish or cancel edits'))
    assert.equal(await page.getByLabel('Title').inputValue(), 'Protected habit draft')
    await page.getByRole('dialog', { name: 'Create habit' }).getByRole('button', { name: 'Close' }).click()
    await page.getByRole('dialog', { name: 'Please confirm' }).getByRole('button', { name: 'Continue' }).click()
    await finishGuardedUpdate()

    // An unadded shopping item is an inline recipe draft, including on retry.
    await prepareDelayedUpdate()
    await openApp('Recipes')
    await page.getByRole('button', { name: /Shopping/ }).click()
    await page.getByLabel('Add an item').fill('Protected shopping draft')
    await page.evaluate(() => window.releaseActivation())
    await page.getByText('Finish or cancel edits', { exact: false }).waitFor()
    assert.equal(await page.getByLabel('Add an item').inputValue(), 'Protected shopping draft')
    await page.getByRole('button', { name: 'Update app' }).click()
    assert.equal(await page.getByLabel('Add an item').inputValue(), 'Protected shopping draft')
    await page.getByLabel('Add an item').fill('')
    await finishGuardedUpdate()

    revision++
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
    await page.getByText('An update is available').waitFor()
    await page.evaluate(() => { window.delayActivation = true; window.timeoutActivation = true })
    await page.getByRole('button', { name: 'Update app' }).click()
    await page.getByText('Could not activate the update.', { exact: false }).waitFor()
    await page.getByLabel('Username').fill('After timeout')
    await page.evaluate(() => window.releaseActivation())
    await page.getByText('Update ready to open').waitFor()
    assert.equal(await page.getByLabel('Username').inputValue(), 'After timeout')
    await page.getByLabel('Username').fill('Tester')
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Update app' }).click()])
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
    await page.getByText('No update found.').waitFor()
    const other = await context.newPage(); other.setDefaultTimeout(15000)
    await other.goto(url)
    await other.getByRole('button', { name: 'Settings', exact: true }).last().click()
    await other.getByText('No update found.').waitFor()
    revision++
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
    await page.getByText('An update is available').waitFor()
    await other.getByText('An update is available').waitFor()
    await other.getByLabel('Username').fill('Other tab draft')
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Update app' }).click()])
    await other.getByText('Update ready to open').waitFor()
    assert.equal(await other.getByLabel('Username').inputValue(), 'Other tab draft')
    await other.getByRole('button', { name: 'Update app' }).click()
    await other.getByText('Finish or cancel edits', { exact: false }).waitFor()
    await other.getByLabel('Username').fill('Tester')
    await Promise.all([other.waitForEvent('load'), other.getByRole('button', { name: 'Update app' }).click()])
  } finally {
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL = previousUrl
    if (previousKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY; else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = previousKey
    await browser?.close()
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    await rm(dir, { recursive: true, force: true })
  }
})
