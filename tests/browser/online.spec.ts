import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const owner = '10000000-0000-4000-8000-000000000001'
type Document = { kind: string; id: string; body: Record<string, unknown> }

async function fakeBackend(page: Page) {
  let documents: Document[] = []
  let revision = 0
  let offline = false
  let lastOperation = ''
  await page.route('https://mock.invalid/**', async route => {
    if (offline) { await route.abort('internetdisconnected'); return }
    const request = route.request(); const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); return }
    let body: unknown
    if (path === '/rest/v1/rpc/tor_online_workout_read') body = { revision, documents }
    else if (path === '/rest/v1/rpc/tor_online_workout_write') {
      const input = request.postDataJSON()
      if (input.p_operation === lastOperation) body = { status: 'ok', revision }
      else if (input.p_revision !== revision) body = { status: 'conflict' }
      else { documents = input.p_documents; revision++; lastOperation = input.p_operation; body = { status: 'ok', revision } }
    } else if (path === '/auth/v1/user') body = { id: owner, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated' }
    else { await route.abort(); throw new Error(`Unexpected mock API path: ${path}`) }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  })
  await page.addInitScript(id => {
    const user = { id, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated' }
    const session = { access_token: 'fake-test-token', refresh_token: 'fake-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }
    if (!localStorage.getItem('sb-mock-auth-token')) localStorage.setItem('sb-mock-auth-token', JSON.stringify(session))
  }, owner)
  return { records: () => documents, offline: (value: boolean) => { offline = value }, conflict: () => { revision++ } }
}

test('account writes are server-confirmed, retry after failure, and reload from the server', async ({ page }) => {
  const backend = await fakeBackend(page)
  await page.goto('/')
  await expect.poll(() => backend.records().length).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  backend.offline(true)
  await page.getByRole('button', { name: 'Skip this day in the cycle' }).click()
  await page.getByRole('button', { name: 'Skip day', exact: true }).click()
  await expect(page.getByText('Could not save workout data')).toBeVisible()
  expect(backend.records().find(item => item.kind === 'routine')?.body.completed).toEqual([])
  backend.offline(false)
  await page.getByRole('button', { name: 'Retry save' }).click()
  await expect(page.getByText('Could not save workout data')).toBeHidden()
  await expect.poll(() => backend.records().find(item => item.kind === 'routine')?.body.completed).toEqual(['Push'])
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('one-ring-user-')))).toEqual([])
  await page.reload()
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await expect(page.getByText('1 of 4 days accounted for')).toBeVisible()
  backend.conflict()
  await page.getByRole('button', { name: 'Skip this day in the cycle' }).click()
  await page.getByRole('button', { name: 'Skip day', exact: true }).click()
  await expect(page.getByText('Workout data changed elsewhere')).toBeVisible()
})

test('demo resets after refresh', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Skip this day in the cycle' }).click()
  await page.getByRole('button', { name: 'Skip day', exact: true }).click()
  await expect(page.getByText('2 of 4 days accounted for')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await expect(page.getByText('1 of 4 days accounted for')).toBeVisible()
})

test('settings displays the version from package metadata', async ({ page }) => {
  const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
  await expect(page.getByText(`The One Ring · v${version}`)).toBeVisible()
})

test('confirmed exercise survives reload and workout completion commits together', async ({ page }) => {
  const backend = await fakeBackend(page)
  await page.goto('/')
  await expect.poll(() => backend.records().length).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Start workout', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Move later' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Move earlier' })).toHaveCount(0)
  await page.getByLabel('Weight in kilograms', { exact: true }).fill('20')
  await page.getByRole('button', { name: '12 / 10 / 8' }).click()
  await page.getByPlaceholder('How did it feel?').fill('Test note')
  await page.getByRole('button', { name: 'Save exercise log' }).click()
  await expect(page.getByText('Log saved', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: /Workout in progress/ }).click()
  await page.getByRole('button', { name: /Previous/ }).click()
  await expect(page.getByText('Log saved', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Finish early' }).click()
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click()
  await expect.poll(() => backend.records().some(item => item.kind === 'workout')).toBe(true)
  expect(backend.records().some(item => item.kind === 'session')).toBe(false)
  expect(backend.records().find(item => item.kind === 'routine')?.body.completed).toEqual(['Push'])
  const workout = backend.records().find(item => item.kind === 'workout')?.body as { exercises: { note?: string }[] }
  expect(workout.exercises[0].note).toBe('Test note')
  const saved = backend.records().find(item => item.kind === 'workout')!.body
  expect(saved.routineName).toBe('My routine')
  expect((saved.plan as { name: string; slotId: string }[])[0].name).toBe('Chest press')
  expect((saved.exercises as { sessionSlotId: string }[])[0].sessionSlotId).toBe((saved.plan as { slotId: string }[])[0].slotId)
  expect((backend.records().find(item => item.kind === 'routine')!.body.cycleHistory as { type: string }[]).some(event => event.type === 'completed')).toBe(true)
  const event = (backend.records().find(item => item.kind === 'routine')!.body.cycleHistory as { type: string; daysSnapshot: { id: string; name: string }[] }[]).find(item => item.type === 'completed')!
  expect(event.daysSnapshot[0].name).toBe('Push')
  expect(event.daysSnapshot[0].id).toBeTruthy()
})

test('export and restore validate before replacement and retry a failed restore', async ({ page }) => {
  const backend = await fakeBackend(page)
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/')
  await expect.poll(() => backend.records().length).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Skip this day in the cycle' }).click()
  await page.getByRole('button', { name: 'Skip day', exact: true }).click()
  await expect.poll(() => backend.records().find(item => item.kind === 'routine')?.body.completed).toEqual(['Push'])
  await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloading
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const contents = Buffer.concat(chunks)
  const backup = JSON.parse(contents.toString())
  expect(backup.data.completed).toEqual(['Push'])

  const invalid = structuredClone(backup)
  invalid.library[0].id = 'not-a-uuid'
  const rejected = page.waitForEvent('dialog')
  await page.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) })
  expect((await rejected).message()).toContain('Unable to restore')
  expect(backend.records().find(item => item.kind === 'routine')?.body.completed).toEqual(['Push'])

  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Skip this day in the cycle' }).click()
  await page.getByRole('button', { name: 'Skip day', exact: true }).click()
  await expect.poll(() => backend.records().find(item => item.kind === 'routine')?.body.completed).toEqual(['Push', 'Pull'])
  await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
  backend.offline(true)
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: contents })
  await expect(page.getByText('Could not save workout data')).toBeVisible()
  expect(backend.records().find(item => item.kind === 'routine')?.body.completed).toEqual(['Push', 'Pull'])
  backend.offline(false)
  await page.getByRole('button', { name: 'Retry save' }).click()
  await expect.poll(() => backend.records().find(item => item.kind === 'routine')?.body.completed).toEqual(['Push'])
  await page.reload()
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await expect(page.getByText('1 of 4 days accounted for')).toBeVisible()
})

test('browse and correct an older workout with readable results', async ({ page }) => {
  const backend = await fakeBackend(page)
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/')
  await expect.poll(() => backend.records().length).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Start workout', exact: true }).click()
  await page.getByLabel('Weight in kilograms', { exact: true }).fill('20')
  await page.getByRole('button', { name: '12 / 10 / 8' }).click()
  await page.getByRole('button', { name: 'Save exercise log' }).click()
  await page.getByRole('button', { name: 'Finish early' }).click()
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click()
  await expect.poll(() => backend.records().filter(item => item.kind === 'workout').length).toBe(1)
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Start workout', exact: true }).click()
  await page.getByRole('button', { name: 'Finish early' }).click()
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click()
  await expect.poll(() => backend.records().filter(item => item.kind === 'workout').length).toBe(2)
  await page.getByRole('button', { name: 'All workouts' }).click()
  await page.locator('.history-button').filter({ hasText: 'Push' }).click()
  await expect(page.locator('.review-exercise .compact-result').first()).toBeVisible()
  await page.getByRole('button', { name: 'Edit result or note' }).first().click()
  await page.getByLabel('Set 1 reps').fill('11')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => {
    const workout = backend.records().find(item => item.kind === 'workout' && item.body.day === 'Push')
    return (workout?.body.exercises as { sets: { reps: string }[] }[])?.[0].sets[0].reps
  }).toBe('11')
  await page.reload()
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await page.locator('.history-button').filter({ hasText: 'Push' }).click()
  await expect(page.locator('.review-exercise .compact-result').first()).toContainText('11 / 10 / 8')
})

test('exact-variant strength progress shows chart and structured recent results', async ({ page }) => {
  const backend = await fakeBackend(page)
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/')
  await expect.poll(() => backend.records().length).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Start workout', exact: true }).click()
  await page.getByLabel('Weight in kilograms', { exact: true }).fill('20')
  await page.getByRole('button', { name: '12 / 10 / 8' }).click()
  await page.getByRole('button', { name: 'Save exercise log' }).click()
  await page.getByRole('button', { name: 'Finish early' }).click()
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click()
  await expect.poll(() => backend.records().filter(item => item.kind === 'workout').length).toBe(1)
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.locator('.day-row').filter({ hasText: 'Push day' }).click()
  await page.getByRole('button', { name: 'Start push day' }).click()
  await expect(page.locator('.recent-table .compact-result')).toBeVisible()
  await page.getByLabel('Weight in kilograms', { exact: true }).fill('22.5')
  await page.getByRole('button', { name: 'Save exercise log' }).click()
  await page.getByRole('button', { name: 'Finish early' }).click()
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click()
  await expect.poll(() => backend.records().filter(item => item.kind === 'workout').length).toBe(2)
  await page.getByRole('button', { name: 'All workouts' }).click()
  await page.getByRole('combobox', { name: 'Exercise', exact: true }).selectOption({ label: 'Chest press · Chest press machine' })
  await page.getByText('Show strength chart').click()
  await expect(page.getByRole('heading', { name: 'Top recorded weight' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '22.5 kg' }).first()).toBeVisible()
})

test('history filters by exercise identity and dates, and reveals older pages', async ({ page }) => {
  const backend = await fakeBackend(page)
  await page.goto('/')
  await expect.poll(() => backend.records().length).toBeGreaterThan(0)
  const exercises = backend.records().filter(item => item.kind === 'exercise')
  const first = exercises.find(item => item.body.name === 'Chest press')!
  const second = exercises.find(item => item.body.name === 'Shoulder press')!
  const sets = [12, 10, 8].map(reps => ({ weight: '20', reps: String(reps), done: true }))
  for (let i = 1; i <= 12; i++) {
    const id = `30000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    const variant = i === 12 ? second : first
    backend.records().push({ kind: 'workout', id, body: { id, day: 'Push', routineName: i % 2 ? 'Routine A' : 'Routine B', date: `2026-01-${String(i).padStart(2, '0')}T12:00:00.000Z`, exercises: [{ name: variant.body.name, exerciseId: variant.id, skipped: false, sets }] } })
  }
  await page.reload()
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await expect(page.locator('.history-button')).toHaveCount(10)
  await page.getByRole('button', { name: 'Show more workouts' }).click()
  await expect(page.locator('.history-button')).toHaveCount(12)
  await page.getByRole('combobox', { name: 'Exercise', exact: true }).selectOption({ label: 'Chest press · Chest press machine' })
  await expect(page.getByText('11 workouts · showing 10')).toBeVisible()
  await expect(page.locator('.history-button').filter({ hasText: 'Routine A' }).first()).toBeVisible()
  await expect(page.locator('.history-button').filter({ hasText: 'Routine B' }).first()).toBeVisible()
  await page.getByLabel('From', { exact: true }).fill('2026-01-05')
  await page.getByLabel('To', { exact: true }).fill('2026-01-06')
  await expect(page.getByText('2 workouts · showing 2')).toBeVisible()
  await page.getByRole('combobox', { name: 'Exercise', exact: true }).selectOption({ label: 'Shoulder press · Shoulder press machine' })
  await expect(page.getByText('No workouts match these filters.')).toBeVisible()
})
