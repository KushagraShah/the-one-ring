import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { contentMarkdown, emptyContent, emptyNutrition, emptyRecipes, type RecipeData } from '../../src/recipes/model'

const recipeId = '00000000-0000-4000-8000-000000000001'
const source = JSON.stringify({ title: 'Lentil curry', portions: '4', nutrition: { scope: 'curry only', calories: '~400–450', protein: '25', carbs: '40', fat: '10' }, fresh: ['400 g lentils'], pantry: ['10 g oil'], steps: ['Prepare\n\n1. Rinse.\n2. Drain.', 'Simmer\n\nStir occasionally.'], notes: 'Serving idea: rice.' })
const nav = (page: Page) => page.getByRole('navigation', { name: 'Recipe Book', exact: true })
async function demo(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Go to recipes' }).click()
}
async function importCurry(page: Page) {
  await page.getByRole('button', { name: '+ Add recipe' }).click()
  await page.getByRole('button', { name: 'Import Markdown or JSON' }).click()
  await page.getByLabel('Markdown or JSON', { exact: true }).fill(source)
  await page.getByRole('button', { name: 'Review imported recipe' }).click()
}
async function addRice(page: Page) {
  await page.getByRole('button', { name: 'Add side', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Rice')
  await page.getByLabel('Portion', { exact: true }).fill('100 g cooked')
  await page.getByLabel('Shopping item and quantity (optional)').fill('200 g dry rice')
  for (const [label, value] of [['Calories (kcal)', '100'], ['Protein (g)', '3'], ['Carbs (g)', '20'], ['Fat (g)', '0']]) await page.getByLabel(label, { exact: true }).fill(value)
  await page.getByRole('button', { name: 'Save side' }).click()
}

test('guided import, side totals, shopping append and cooking keep independent copies', async ({ page }) => {
  await demo(page)
  await importCurry(page)
  const review = page.getByRole('dialog', { name: 'Review', exact: true })
  await expect(review).toContainText('2 ingredients · 2 steps')
  await page.getByRole('button', { name: 'Compare original import' }).click()
  await expect(page.getByRole('dialog', { name: 'Original import', exact: true })).toContainText(source)
  await page.keyboard.press('Escape')
  await expect(review).toBeVisible()
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
  await page.getByRole('button', { name: 'View original import' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Lentil curry', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Recipe options', exact: true }).click()
  await page.getByRole('button', { name: 'Add to rotation', exact: true }).click()
  await page.getByRole('button', { name: 'Close recipe options' }).click()
  await page.getByRole('button', { name: 'Add to plan', exact: true }).click()
  const meal = page.locator('.plan-card')
  await meal.getByRole('button', { name: 'Choose side' }).click()
  await addRice(page)
  await page.getByRole('button', { name: 'Choose', exact: true }).click()
  await expect(meal).toContainText('Combined per meal: ~500–550 kcal · 28 g protein · 60 g carbs · 10 g fat')
  for (const width of [320, 390, 760]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('button', { name: 'Manage sides' }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Brown rice')
  await page.getByRole('button', { name: 'Save side' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog', { name: 'Please confirm' }).getByRole('button', { name: 'Delete side', exact: true }).click()
  await page.getByRole('button', { name: 'Close meal prep window' }).click()
  await expect(meal).toContainText('Side: Rice')
  await page.getByRole('button', { name: 'Review shopping list' }).click()
  await page.getByRole('button', { name: 'Create shopping list', exact: true }).click()
  await expect(page.locator('.shopping-item')).toHaveCount(3)
  await page.locator('.shopping-item').filter({ hasText: '400 g lentils' }).getByRole('button', { name: 'Bought' }).click()
  await page.getByRole('button', { name: 'Add recipes', exact: true }).click()
  await page.getByLabel('🍲 Tofu rice bowl', { exact: true }).check()
  await page.getByRole('button', { name: 'Add selected recipes' }).click()
  await expect(page.locator('.shopping-item')).toHaveCount(7)
  await nav(page).getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Review shopping list' }).click()
  await page.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.locator('.shopping-item')).toHaveCount(7)
  await expect(page.locator('.shopping-item').filter({ hasText: '400 g lentils' })).toHaveClass(/is-bought/)
  await nav(page).getByRole('button', { name: 'Recipes', exact: true }).click()
  await page.getByRole('button', { name: /Lentil curry/ }).click()
  await page.getByRole('button', { name: 'Edit recipe' }).click()
  await page.getByRole('navigation', { name: 'Recipe editor sections' }).getByRole('button', { name: 'Ingredients' }).click()
  await page.getByLabel('Fresh / weekly').fill('500 g lentils')
  await page.getByRole('button', { name: 'Review recipe' }).click()
  await expect(page.getByText('Ingredients or portions changed; check the saved macros. They are not recalculated.')).toBeVisible()
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
  await page.getByRole('button', { name: 'Close recipe' }).click()
  await nav(page).getByRole('button', { name: 'Plan', exact: true }).click()
  await expect(meal).toContainText('This plan keeps its chosen copy.')
  await meal.getByRole('button', { name: 'Start cooking' }).click()
  await expect(page.getByText('Planned side: Rice')).toBeVisible()
  await expect(page.locator('.recipe-step')).toContainText('Rinse.')
  await expect(page.locator('.recipe-step')).toContainText('Drain.')
  await page.getByRole('button', { name: 'View full recipe' }).click()
  await expect(page.getByRole('dialog', { name: 'Lentil curry' })).toContainText('400 g lentils')
  await page.getByRole('button', { name: 'Close full recipe' }).click()
  await page.getByRole('button', { name: 'Finish cooking', exact: true }).click()
  await page.getByRole('button', { name: 'Finish and record', exact: true }).click()
  await nav(page).getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Start next prep' }).click()
  await page.getByRole('button', { name: 'Clear plan', exact: true }).click()
  await expect(page.locator('.plan-suggestion')).toContainText('Tofu rice bowl')
  await nav(page).getByRole('button', { name: /Shopping/ }).click()
  await expect(page.locator('.shopping-item')).toHaveCount(7)
})

test('guided ideas, side drafts and incomplete nutrition use explicit choices', async ({ page }) => {
  await demo(page)
  const add = page.getByRole('button', { name: '+ Add recipe' })
  await add.click()
  await page.getByLabel('Recipe name', { exact: true }).fill('Soup idea')
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Please confirm' }).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Recipe name', { exact: true })).toHaveValue('Soup idea')
  await page.getByRole('button', { name: 'Review recipe' }).click()
  await page.getByRole('button', { name: 'Save as idea' }).click()
  await expect(page.getByRole('button', { name: 'Add to plan', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close recipe' }).click()
  await nav(page).getByRole('button', { name: 'Cooking', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start cooking Soup idea' })).toHaveCount(0)
  await nav(page).getByRole('button', { name: 'Recipes', exact: true }).click()
  await page.getByRole('button', { name: /Soup idea/ }).click()
  await page.getByRole('button', { name: 'Edit recipe' }).click()
  await page.getByRole('button', { name: 'Review recipe' }).click()
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
  await expect(page.locator('.recipe-status-line')).toContainText('Ready')
  await page.getByRole('button', { name: 'Add to plan' }).click()
  await page.getByRole('button', { name: 'Choose side' }).click()
  await page.getByRole('button', { name: 'Add side', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Bread')
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Please confirm' }).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Bread')
  await page.getByRole('button', { name: 'Save side' }).click()
  await page.getByRole('button', { name: 'Choose', exact: true }).click()
  await expect(page.locator('.plan-card')).toContainText('Combined nutrition incomplete')
  await expect(page.locator('.plan-card')).not.toContainText('Combined per meal:')
  await nav(page).getByRole('button', { name: 'Recipes', exact: true }).click()
  await add.click()
  await page.getByLabel('Recipe name', { exact: true }).fill('Discard me')
  await page.getByRole('button', { name: 'Close guided editor' }).click()
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(add).toBeFocused()
})

async function account(page: Page, initial: RecipeData) {
  const owner = '10000000-0000-4000-8000-000000000001'
  const state = { data: initial, revision: 1, fail: false }
  await page.route('https://mock.invalid/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    let body: unknown
    if (path.endsWith('tor_online_recipe_read')) body = { revision: state.revision, data: state.data }
    else if (path.endsWith('tor_online_recipe_write')) {
      if (state.fail) { await new Promise(resolve => setTimeout(resolve, 800)); await route.fulfill({ status: 503, headers, body: 'unavailable' }); return }
      const input = request.postDataJSON()
      if (input.p_revision !== state.revision) body = { status: 'conflict' }
      else { state.data = input.p_data; body = { status: 'ok', revision: ++state.revision } }
    } else if (path.endsWith('tor_online_habit_read')) body = { revision: 0, data: null }
    else if (path.endsWith('tor_online_workout_read')) body = { revision: 0, documents: [] }
    else if (path.endsWith('tor_online_workout_write')) body = { revision: 1, status: 'ok' }
    else if (path === '/auth/v1/user') body = { id: owner, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: {} }
    else { await route.abort(); return }
    await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.addInitScript(id => {
    const user = { id, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: {} }
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: 'fake-test-token', refresh_token: 'fake-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }))
  }, owner)
  await page.goto('/')
  await page.getByRole('button', { name: 'Go to recipes' }).click()
  return state
}

test('stale recipe saves preserve a recoverable draft and reload the winning account copy', async ({ page }) => {
  const content = { ...emptyContent(), title: 'Original soup', steps: ['Cook.'] }
  const recipe = { id: recipeId, content, markdown: contentMarkdown(content) }
  const initial: RecipeData = { ...emptyRecipes(), recipes: [recipe], meta: { [recipeId]: { idea: false, archived: false, rotation: true } } }
  const state = await account(page, initial)
  await page.getByRole('button', { name: /Original soup/ }).click()
  await page.getByRole('button', { name: 'Edit recipe' }).click()
  await page.getByLabel('Recipe name', { exact: true }).fill('Unsaved soup')
  const remoteContent = { ...content, title: 'Saved elsewhere' }
  state.data = { ...initial, recipes: [{ ...recipe, content: remoteContent, markdown: contentMarkdown(remoteContent) }] }
  state.revision++
  await page.getByRole('button', { name: 'Review recipe', exact: true }).click()
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
  const recovery = page.getByRole('dialog', { name: 'Recipes changed elsewhere' })
  await expect(recovery).toBeVisible()
  await expect(recovery.getByRole('button', { name: 'Retry recipe save' })).toHaveCount(0)
  const download = page.waitForEvent('download')
  await recovery.getByRole('button', { name: 'Export unsaved recipes' }).click()
  const backup = JSON.parse(readFileSync((await (await download).path())!, 'utf8'))
  expect(backup.data.recipes[0].content.title).toBe('Unsaved soup')
  expect(state.data.recipes[0].content?.title).toBe('Saved elsewhere')
  await recovery.getByRole('button', { name: 'Discard and reload' }).click()
  await page.getByRole('dialog', { name: 'Please confirm' }).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(recovery).toBeVisible()
  await recovery.getByRole('button', { name: 'Discard and reload' }).click()
  await page.getByRole('dialog', { name: 'Please confirm' }).getByRole('button', { name: 'Discard and reload', exact: true }).click()
  await page.getByRole('button', { name: 'Go to recipes' }).click()
  await expect(page.getByRole('button', { name: /Saved elsewhere/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Unsaved soup/ })).toHaveCount(0)
})

test('plans, sides and preparation dates survive reload and backups; failed saves preserve side drafts', async ({ page }) => {
  const content = { ...emptyContent(), title: 'Stored curry', portions: '4', fresh: ['400 g lentils'], steps: ['Cook.'] }
  const recipe = { id: recipeId, content, markdown: contentMarkdown(content), source: 'Retained source' }
  const side = { id: 'side', name: 'Rice', portion: '100 g', shopping: '200 g rice', nutrition: emptyNutrition() }
  const initial: RecipeData = { ...emptyRecipes(), recipes: [recipe], sides: [side], plan: [{ id: 'meal', recipe, side }], meta: { [recipeId]: { idea: false, archived: false, rotation: true, lastPrepared: '2026-11-01' } } }
  const state = await account(page, initial)
  await nav(page).getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Start cooking' }).click()
  await expect(page.getByText('Saving recipes…')).toBeHidden()
  await page.reload()
  await page.getByRole('button', { name: 'Go to recipes' }).click()
  await nav(page).getByRole('button', { name: /Cooking/ }).click()
  await expect(page.getByText('Planned side: Rice')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel cooking', exact: true }).click()
  await page.getByRole('dialog', { name: 'Please confirm' }).getByRole('button', { name: 'Cancel cooking', exact: true }).click()
  await expect.poll(() => state.data.cooking).toBeNull()
  expect(state.data.meta[recipeId].lastPrepared).toBe('2026-11-01')
  await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
  await page.getByRole('button', { name: /Backups/ }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export recipes', exact: true }).click()
  const backup = readFileSync((await (await download).path())!)
  expect(JSON.parse(backup.toString()).data).toEqual(state.data)
  await page.getByRole('button', { name: 'Recipes', exact: true }).last().click()
  await nav(page).getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Start next prep' }).click()
  await page.getByRole('button', { name: 'Clear plan', exact: true }).click()
  await expect.poll(() => state.data.plan.length).toBe(0)
  await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
  await page.getByRole('button', { name: /Backups/ }).click()
  await page.getByLabel('Restore recipes', { exact: true }).setInputFiles({ name: 'recipes.json', mimeType: 'application/json', buffer: backup })
  await page.getByRole('button', { name: 'Restore recipes', exact: true }).click()
  await expect.poll(() => state.data.plan.length).toBe(1)
  await page.getByRole('button', { name: 'Recipes', exact: true }).last().click()
  await nav(page).getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Manage sides' }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  state.fail = true
  await page.getByLabel('Name', { exact: true }).fill('Rice saved locally')
  await page.getByRole('button', { name: 'Save side' }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Rice draft to recover')
  const recovery = page.getByRole('dialog', { name: 'Could not save recipes' })
  await expect(recovery).toBeVisible()
  const draftDownload = page.waitForEvent('download')
  await recovery.getByRole('button', { name: 'Export text drafts' }).click()
  expect(JSON.parse(readFileSync((await (await draftDownload).path())!, 'utf8')).side.name).toBe('Rice draft to recover')
  state.fail = false
  await recovery.getByRole('button', { name: 'Retry recipe save' }).click()
  await expect(recovery).toBeHidden()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Rice draft to recover')
})
