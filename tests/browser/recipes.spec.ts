import { expect, test } from '@playwright/test'

test('recipe views use readable ring-themed colors', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Go to recipes' }).click()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'recipes')
  await expect(page.locator('.app-shell')).toHaveCSS('--accent', '#efaa89')
  await expect(page.locator('.app-strip-button.active .app-strip-icon').last()).toHaveCSS('border-color', 'rgb(239, 170, 137)')
  const contrast = async (selector: string) => page.locator(selector).first().evaluate(element => {
    const styles = getComputedStyle(element)
    const lum = (value: string) => {
      const channels = value.match(/\d+/g)!.slice(0, 3).map(Number).map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 })
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
    }
    const [a, b] = [lum(styles.color), lum(styles.backgroundColor)].sort((x, y) => y - x)
    return (a + .05) / (b + .05)
  })
  expect(await contrast('.recipe-card')).toBeGreaterThan(4.5)
  expect(await contrast('.recipe-primary')).toBeGreaterThan(4.5)
  expect(await contrast('.recipe-tabs button[aria-current]')).toBeGreaterThan(4.5)
  await page.getByRole('button', { name: /Tofu rice bowl/ }).click()
  await page.getByRole('button', { name: 'Start cooking' }).click()
  await page.getByRole('button', { name: 'View full recipe' }).click()
  expect(await contrast('.recipe-document')).toBeGreaterThan(4.5)
  await page.getByRole('button', { name: '← Back to cooking' }).click()
  await expect(page.locator('.recipe-step')).toHaveCSS('background-color', 'rgb(48, 55, 42)')
  await page.getByRole('navigation', { name: 'Recipe Book' }).getByRole('button', { name: /Shopping/ }).click()
  await page.getByLabel('🍲 Tofu rice bowl').check()
  await page.getByRole('button', { name: 'Start shopping' }).click()
  await expect(page.getByText('400 g tofu')).toBeVisible()
})

test('recipe shopping and cooking resume after account reload', async ({ page }) => {
  const owner = '10000000-0000-4000-8000-000000000001'
  let recipes: unknown = null; let revision = 0; let workoutRevision = 0; let documents: unknown[] = []
  await page.route('https://mock.invalid/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); return }
    let body: unknown
    if (path.endsWith('tor_online_recipe_read')) body = { revision, data: recipes }
    else if (path.endsWith('tor_online_recipe_write')) { const input = request.postDataJSON(); if (input.p_revision !== revision) body = { status: 'conflict' }; else { recipes = input.p_data; revision++; body = { status: 'ok', revision } } }
    else if (path.endsWith('tor_online_habit_read')) body = { revision: 0, data: null }
    else if (path.endsWith('tor_online_workout_read')) body = { revision: workoutRevision, documents }
    else if (path.endsWith('tor_online_workout_write')) { const input = request.postDataJSON(); documents = input.p_documents; workoutRevision++; body = { status: 'ok', revision: workoutRevision } }
    else if (path === '/auth/v1/user') body = { id: owner, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: {} }
    else { await route.abort(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  })
  await page.addInitScript(id => { const user = { id, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: {} }; if (!localStorage.getItem('sb-mock-auth-token')) localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: 'fake-test-token', refresh_token: 'fake-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user })) }, owner)
  await page.goto('/')
  await page.getByRole('button', { name: 'Go to recipes' }).click()
  await page.getByRole('button', { name: '+ Add recipe' }).click()
  await page.getByLabel('Recipe Markdown').fill('# Bowl\n\nPortions: 4\nMacros per portion: 30 g protein\n\n## Ingredients\n- 400 g tofu\n\n## Pantry\n- 10 g oil\n\n## Instructions\n1. Cut tofu.\n2. Cook tofu.')
  await page.getByRole('button', { name: 'Review recipe' }).click()
  await expect(page.getByRole('heading', { name: 'Ingredients · 2' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Instructions · 2' })).toBeVisible()
  await page.getByRole('button', { name: 'Save recipe' }).click()
  await page.getByRole('button', { name: 'Start cooking' }).click()
  await page.getByRole('button', { name: 'Next →' }).click()
  await expect(page.getByText('Saving recipes…')).toBeHidden()
  await page.reload()
  await page.getByRole('button', { name: 'Go to recipes' }).click()
  await page.getByRole('navigation', { name: 'Recipe Book' }).getByRole('button', { name: /Cooking/ }).click()
  await expect(page.getByText('STEP 2 OF 2')).toBeVisible()
  await page.getByRole('navigation', { name: 'Recipe Book' }).getByRole('button', { name: 'Shopping' }).click()
  await page.getByLabel('Bowl').check()
  await page.getByRole('button', { name: 'Start shopping' }).click()
  await page.locator('.recipe-item').filter({ hasText: '400 g tofu' }).getByRole('button', { name: 'Bought' }).click()
  await expect(page.getByText('Saving recipes…')).toBeHidden()
  await page.reload()
  await page.getByRole('button', { name: 'Go to recipes' }).click()
  await page.getByRole('navigation', { name: 'Recipe Book' }).getByRole('button', { name: /Shopping/ }).click()
  await expect(page.locator('.shopping-item').filter({ hasText: '400 g tofu' }).getByRole('button', { name: 'Bought' })).toHaveAttribute('aria-pressed', 'true')
})

test('shopping states stay visible and cooking starts directly from its own tab', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Go to recipes' }).click()
  const nav = page.getByRole('navigation', { name: 'Recipe Book' })
  await nav.getByRole('button', { name: 'Cooking' }).click()
  await expect(page.getByRole('heading', { name: 'Choose a recipe' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Cooking' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Start cooking 🍲 Tofu rice bowl' }).click()
  await expect(page.getByText('STEP 1 OF 3')).toBeVisible()
  await nav.getByRole('button', { name: 'Shopping' }).click()
  await page.getByLabel('🍲 Tofu rice bowl').check()
  await page.getByRole('button', { name: 'Start shopping' }).click()
  const tofu = page.locator('.shopping-item').filter({ hasText: '400 g tofu' })
  const rice = page.locator('.shopping-item').filter({ hasText: '200 g rice' })
  await expect(tofu.getByRole('button', { name: 'Mark 400 g tofu from 🍲 Tofu rice bowl as needed' })).toBeDisabled()
  await tofu.getByRole('button', { name: 'Have' }).click()
  await rice.getByRole('button', { name: 'Bought' }).click()
  await expect(tofu).toHaveClass(/is-have/)
  await expect(rice).toHaveClass(/is-bought/)
  await expect(page.locator('.shopping-item').first()).toContainText('400 g tofu')
  await expect(page.getByLabel('Shopping list summary')).toContainText('1 have')
  await expect(page.getByLabel('Shopping list summary')).toContainText('1 bought')
  await tofu.getByRole('button', { name: 'Mark 400 g tofu from 🍲 Tofu rice bowl as needed' }).click()
  await expect(tofu).toHaveClass(/is-needed/)
  for (const width of [320, 390, 760]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('opening a recipe uses a separate mobile window without resizing the library card', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Go to recipes' }).click()
  const card = page.getByRole('button', { name: /Tofu rice bowl/ })
  const before = await card.boundingBox()
  await card.click()
  const detail = page.getByRole('dialog', { name: '🍲 Tofu rice bowl' })
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('heading', { name: '🍲 Tofu rice bowl' })).toBeFocused()
  const after = await card.boundingBox()
  expect(after?.width).toBe(before?.width)
  expect(after?.height).toBe(before?.height)
  const bounds = await detail.boundingBox()
  expect(bounds?.width).toBe(390)
  await page.keyboard.press('Escape')
  await expect(detail).toBeHidden()
  await expect(card).toBeFocused()
  await card.click()
  await page.getByRole('button', { name: 'Close recipe' }).click()
  await expect(detail).toBeHidden()
})

test('recipe import review is a separate screen and preserves draft on return', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Go to recipes' }).click()
  await page.getByRole('button', { name: '+ Add recipe' }).click()
  const text = '# Draft bowl\n\n## Ingredients\n- 200 g tofu\n\n## Instructions\n1. Cook.'
  await page.getByLabel('Recipe Markdown').fill(text)
  await page.getByRole('button', { name: 'Review recipe' }).click()
  await expect(page.getByLabel('Recipe Markdown')).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Review recipe' })).toBeVisible()
  await page.getByRole('button', { name: '← Back to edit' }).click()
  await expect(page.getByLabel('Recipe Markdown')).toHaveValue(text)
})
