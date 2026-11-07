import { expect, test, type Page } from '@playwright/test'

const owner = '10000000-0000-4000-8000-000000000001'
type Row = { kind: string; entity_id: string; revision: number; deleted: boolean; body: any }

async function fakeBackend(page: Page) {
  const records = new Map<string, Row>()
  let offline = false
  let failedRequests = 0
  await page.route('https://mock.invalid/**', async route => {
    if (offline) { failedRequests++; await route.abort('internetdisconnected'); return }
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
      return
    }
    let body: unknown
    if (path === '/rest/v1/tor_sync_records') body = [...records.values()]
    else if (path === '/rest/v1/rpc/tor_apply_sync_batch') {
      const input = request.postDataJSON() as { p_changes: { kind: string; id: string; base_revision: number; deleted: boolean; body: unknown }[] }
      const conflicts = input.p_changes.filter(item => (records.get(`${item.kind}/${item.id}`)?.revision || 0) !== item.base_revision).map(item => ({ kind: item.kind, id: item.id, expected: item.base_revision, actual: records.get(`${item.kind}/${item.id}`)?.revision || 0 }))
      body = conflicts.length ? { status: 'conflict', conflicts } : { status: 'ok', records: input.p_changes.map(item => {
        const revision = item.base_revision + 1
        records.set(`${item.kind}/${item.id}`, { kind: item.kind, entity_id: item.id, revision, deleted: item.deleted, body: item.body })
        return { kind: item.kind, id: item.id, revision }
      }) }
    } else if (path === '/auth/v1/user') body = { id: owner, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated' }
    else { await route.abort(); throw new Error(`Unexpected mock API path: ${path}`) }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  })
  await page.addInitScript(id => {
    const user = { id, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated' }
    const session = { access_token: 'fake-test-token', refresh_token: 'fake-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }
    if (!localStorage.getItem('sb-mock-auth-token')) localStorage.setItem('sb-mock-auth-token', JSON.stringify(session))
  }, owner)
  return { records, setOffline(value: boolean) { offline = value }, failedRequests: () => failedRequests }
}

test('automatic sync retries offline changes and preserves a conflict', async ({ page }) => {
  const backend = await fakeBackend(page)
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/')
  await page.getByRole('button', { name: /Cloud sync:/ }).click()
  await page.getByRole('button', { name: 'Set up sync' }).click()
  await expect(page.getByRole('status')).toContainText('Synced with your account')
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Skip this day in the cycle' }).click()
  await page.getByRole('button', { name: 'Skip day', exact: true }).click()
  await expect.poll(() => [...backend.records.values()].some(row => row.kind === 'routine' && row.body.completed.includes('Push'))).toBe(true)
  backend.setOffline(true)
  await page.getByRole('button', { name: 'Skip this day in the cycle' }).click()
  await page.getByRole('button', { name: 'Skip day', exact: true }).click()
  await expect.poll(backend.failedRequests, { timeout: 15000 }).toBeGreaterThan(0)
  await expect.poll(() => [...backend.records.values()].some(row => row.kind === 'routine' && row.body.completed.includes('Pull'))).toBe(false)
  backend.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => [...backend.records.values()].some(row => row.kind === 'routine' && row.body.completed.includes('Pull'))).toBe(true)
  const routine = [...backend.records.values()].find(row => row.kind === 'routine')!
  backend.setOffline(true)
  routine.body = { ...routine.body, name: 'Remote change' }
  routine.revision++
  await page.getByRole('button', { name: 'Skip this day in the cycle' }).click()
  await page.getByRole('button', { name: 'Skip day', exact: true }).click()
  backend.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByRole('button', { name: /Cloud sync: A sync conflict/ })).toBeVisible()
  await page.getByRole('button', { name: /Cloud sync: A sync conflict/ }).click()
  await page.getByRole('button', { name: 'Keep local' }).click()
  await expect.poll(() => [...backend.records.values()].some(row => row.kind === 'routine' && row.body.completed.includes('Accessories'))).toBe(true)
})
