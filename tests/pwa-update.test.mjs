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
    const page = await browser.newPage()
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
