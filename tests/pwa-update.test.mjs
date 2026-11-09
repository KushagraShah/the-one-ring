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
    await page.getByRole('button', { name: 'Prepare update' }).click()
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
