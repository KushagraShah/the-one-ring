import { expect, test, type Page } from '@playwright/test'

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

test('confirmed exercise survives reload and workout completion commits together', async ({ page }) => {
  const backend = await fakeBackend(page)
  await page.goto('/')
  await expect.poll(() => backend.records().length).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: 'Start workout', exact: true }).click()
  await page.getByRole('button', { name: 'Move later' }).click()
  await page.getByLabel('Weight in kilograms', { exact: true }).fill('20')
  await page.getByRole('button', { name: '12 / 10 / 8' }).click()
  await page.getByPlaceholder('How did it feel?').fill('Test note')
  await page.getByRole('button', { name: 'Save exercise log' }).click()
  await expect(page.getByText('Log saved', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Workouts', exact: true }).first().click()
  await page.getByRole('button', { name: /Workout in progress/ }).click()
  await page.getByRole('button', { name: /Next/ }).click()
  await expect(page.getByText('Log saved', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Finish early' }).click()
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click()
  await expect.poll(() => backend.records().some(item => item.kind === 'workout')).toBe(true)
  expect(backend.records().some(item => item.kind === 'session')).toBe(false)
  expect(backend.records().find(item => item.kind === 'routine')?.body.completed).toEqual(['Push'])
  const workout = backend.records().find(item => item.kind === 'workout')?.body as { exercises: { note?: string }[] }
  expect(workout.exercises[1].note).toBe('Test note')
  const saved = backend.records().find(item => item.kind === 'workout')!.body
  expect(saved.routineName).toBe('My routine')
  expect((saved.plan as { name: string; slotId: string }[])[0].name).toBe('Chest press')
  expect((saved.exercises as { sessionSlotId: string }[])[1].sessionSlotId).toBe((saved.plan as { slotId: string }[])[0].slotId)
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
  await page.getByRole('button', { name: /Push.*exercises completed/ }).click()
  await expect(page.getByRole('table').first()).toBeVisible()
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
  await page.getByRole('button', { name: /Push.*exercises completed/ }).click()
  await expect(page.getByRole('cell', { name: '11', exact: true })).toBeVisible()
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
  await expect(page.locator('.recent-result .result-table')).toBeVisible()
  await page.getByLabel('Weight in kilograms', { exact: true }).fill('22.5')
  await page.getByRole('button', { name: 'Save exercise log' }).click()
  await page.getByRole('button', { name: 'Finish early' }).click()
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click()
  await expect.poll(() => backend.records().filter(item => item.kind === 'workout').length).toBe(2)
  await page.getByRole('button', { name: 'All workouts' }).click()
  await page.getByLabel('Exercise progress').selectOption({ label: 'Chest press' })
  await expect(page.getByRole('heading', { name: 'Top recorded weight' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '22.5 kg' }).first()).toBeVisible()
})
