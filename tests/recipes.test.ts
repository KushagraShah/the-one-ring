import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { contentMarkdown, emptyNutrition, emptyRecipes, parseMarkdown, parseRecipeData, recipeView, template } from '../src/recipes/model'
import { importRecipe, sumNutrition } from '../src/recipes/importRecipe'
import { OnlineRecipeStore } from '../src/recipes/online'

test('template extraction preserves exact lines and handles absent fields', () => {
  const parsed = parseMarkdown(template)
  assert.equal(parsed.title, '🥣 Recipe name')
  assert.equal(parsed.portions, '4')
  assert.equal(parsed.macros, '450 kcal · 30 g protein · 50 g carbs · 15 g fat')
  assert.deepEqual(parsed.ingredients.map(i => [i.text, i.pantry]), [['400 g tofu', false], ['200 g rice', false], ['10 g oil', true]])
  assert.equal(parsed.steps.length, 2)
  assert.equal(parsed.quickGlance, '- Press tofu, then prepare rice and vegetables.\n- Cook everything and divide into 4 portions.')
  assert.equal(parseMarkdown('# Name\n\nOther content').steps.length, 0)
  assert.equal(parseMarkdown('# Name\n\nOther content').quickGlance, '')
})

test('quick glance preserves authored Markdown and stops at the next section', () => {
  const markdown = '# Bowl\n\n## Quick glance\n**Batch:** 4 portions\n\n| Step | Time |\n| --- | --- |\n| Bake | 20 min |\n\n### Oven\nUse 180°C.\n\n## Ingredients\n- 400 g tofu'
  const parsed = parseMarkdown(markdown)
  assert.match(parsed.quickGlance, /\*\*Batch:\*\* 4 portions/)
  assert.match(parsed.quickGlance, /### Oven/)
  assert.doesNotMatch(parsed.quickGlance, /400 g tofu/)
  assert.equal(parsed.ingredients[0].text, '400 g tofu')
})

test('partial ingredient and instruction extraction warns without inventing lines', () => {
  const parsed = parseMarkdown('# Bowl\n\n## Ingredients\n- 400 g tofu\n### Sauce\n| amount | item |\n| --- | --- |\n| 20 g | oil |\n\n## Instructions\n1. Cook tofu.\nUnindented continuation.\n2. Finish.')
  assert.deepEqual(parsed.ingredients.map(item => item.text), ['400 g tofu'])
  assert.deepEqual(parsed.steps, ['Cook tofu.', 'Finish.'])
  assert.ok(parsed.warnings.some(w => w.includes('ingredients')))
  assert.ok(parsed.warnings.some(w => w.includes('instruction')))
})

test('legacy indented instruction and ingredient extraction remains compatible with active snapshots', () => {
  const markdown = '# Nested\n\n## Ingredients\n- 100 g tofu\n  - 10 g oil\n\n## Instructions\n1. Start.\n   1. Continue.\n2. Finish.'
  const parsed = parseMarkdown(markdown)
  assert.deepEqual(parsed.ingredients.map(item => item.text), ['100 g tofu', '10 g oil'])
  assert.deepEqual(parsed.steps, ['Start.', 'Continue.', 'Finish.'])
  assert.ok(parsed.warnings.some(w => w.includes('Indented ingredients')))
  assert.ok(parsed.warnings.some(w => w.includes('Indented numbered instruction')))
  const recipe = { id: '00000000-0000-4000-8000-000000000001', markdown }
  assert.equal(parseRecipeData(JSON.stringify({ ...emptyRecipes(), recipes: [recipe], cooking: { recipe, step: 2 } })).cooking?.step, 2)
})

test('workspace validation keeps phase snapshots and rejects invalid data', () => {
  const recipe = { id: '00000000-0000-4000-8000-000000000001', markdown: template }
  const data = { ...emptyRecipes(), recipes: [recipe], cooking: { recipe, step: 1 } }
  assert.deepEqual(parseRecipeData(JSON.stringify(data)), data)
  assert.throws(() => parseRecipeData(JSON.stringify({ ...data, cooking: { recipe, step: 4 } })))
  assert.throws(() => parseRecipeData(JSON.stringify({ ...data, recipes: [recipe, recipe] })))
  assert.deepEqual(parseRecipeData(JSON.stringify({ ...data, shopping: { items: [] } })).shopping, { items: [] })
  assert.throws(() => parseRecipeData(JSON.stringify({ ...data, shopping: { items: [], sources: [recipe, recipe] } })))
})

test('legacy recipe workspaces upgrade without changing phase snapshots', () => {
  const recipe = { id: '00000000-0000-4000-8000-000000000001', markdown: template }
  const old = { version: 1, recipes: [recipe], shopping: { items: [], sources: [recipe] }, cooking: { recipe, step: 1 } }
  const upgraded = parseRecipeData(JSON.stringify(old))
  assert.equal(upgraded.version, 3)
  assert.deepEqual(upgraded.shopping, old.shopping)
  assert.deepEqual(upgraded.cooking, old.cooking)
  assert.deepEqual(upgraded.meta, {})
  assert.deepEqual(upgraded.plan, [])
  assert.deepEqual(upgraded.sides, [])
  const meta = { [recipe.id]: { archived: false, idea: false, rotation: true } }
  assert.deepEqual(parseRecipeData(JSON.stringify({ ...old, version: 2, meta })).meta, meta)
  assert.throws(() => parseRecipeData(JSON.stringify({ ...upgraded, meta: { [recipe.id]: { archived: 'yes' } } })))
})

test('guided import keeps major steps, nested lists, pantry groups and nutrition ranges', () => {
  const source = `# 🥘 Curry
**Serves:** 4
## 🧮 Nutrition per portion
| Nutrient | Per batch | Per portion |
| --- | --- | --- |
| Calories | 1800–2000 kcal | ~450–500 kcal |
| Protein | 120 g | 30 g |
| Carbs | 200 g | 50 g |
| Fat | 60 g | 15 g |
## 🛒 Ingredients
### Fresh / weekly groceries
| Ingredient | Quantity | Notes |
| --- | --- | --- |
| Tofu | 400 g | drained |
### Pantry / shelf
- 10 g oil
## 👩‍🍳 Instructions
### 1. Prepare ingredients
Cut the tofu.

1. Drain.
2. Cube.
### 2. Cook with pantry spices
Cook slowly.

Serve hot.
## Notes
Keep refrigerated.`
  const { content, warnings } = importRecipe(source)
  assert.deepEqual(warnings, [])
  assert.equal(content.portions, '4')
  assert.deepEqual(content.fresh, ['Tofu — 400 g · drained'])
  assert.deepEqual(content.pantry, ['10 g oil'])
  assert.equal(content.nutrition.calories, '~450–500')
  assert.equal(content.steps.length, 2)
  assert.match(content.steps[0], /1\. Drain\.\n2\. Cube\./)
  assert.match(content.steps[1], /Cook slowly\.\n\nServe hot\./)
  const recipe = { id: '00000000-0000-4000-8000-000000000001', content, markdown: contentMarkdown(content), source }
  assert.deepEqual(recipeView(recipe).steps, content.steps)
  assert.deepEqual(parseRecipeData(JSON.stringify({ ...emptyRecipes(), recipes: [recipe], cooking: { recipe, step: 1 } })).recipes[0], recipe)
})

test('template imports into structured fields and conflicting values require a decision', () => {
  const imported = importRecipe(template)
  assert.equal(imported.content.nutrition.protein, '30')
  assert.equal(imported.content.steps.length, 2)
  assert.deepEqual(imported.warnings, [])
  const conflicting = importRecipe(`${template}\n\n## Nutrition\nProtein: 40 g`)
  assert.equal(conflicting.content.nutrition.protein, '')
  assert.ok(conflicting.warnings.some(w => w.includes('Conflicting protein')))
  const batch = importRecipe('# Soup\n## Nutrition\n| Nutrient | Per batch |\n| --- | --- |\n| Calories | 1000 kcal |')
  assert.equal(batch.content.nutrition.calories, '')
  assert.ok(batch.warnings.length)
})

test('JSON import validates fields and rough notes retain an explicit review path', () => {
  const { content, warnings } = importRecipe(JSON.stringify({ title: 'Concept', notes: 'Try with lentils', steps: ['Cook\n\n- Simmer\n- Taste'], nutrition: { calories: '~400' }, unknown: 'Retained in source' }))
  assert.equal(content.notes, 'Try with lentils')
  assert.equal(content.steps.length, 1)
  assert.ok(warnings.some(w => w.includes('JSON fields')))
  assert.ok(warnings.some(w => w.includes('ingredients')))
  assert.throws(() => importRecipe('{"title":"Bowl","fresh":[4]}'), /array of text/)
  const rough = importRecipe('Lentil idea\nTry with rice\nNo quantities yet')
  assert.equal(rough.content.description, 'Lentil idea')
  assert.ok(rough.warnings.some(w => w.includes('title')))
})

test('combined nutrition sums complete portions conservatively, including ranges and zero', () => {
  const a = { scope: 'curry only', calories: '~400–450', protein: '20.5', carbs: '40–45', fat: '0' }
  const b = { scope: 'side', calories: '100', protein: '3', carbs: '20', fat: '0' }
  assert.deepEqual(sumNutrition(a, b), { scope: 'per meal', calories: '~500–550', protein: '23.5', carbs: '60–65', fat: '0' })
  assert.equal(sumNutrition(a, { ...b, fat: '' }), null)
  assert.equal(sumNutrition(a, { ...b, protein: 'unknown' }), null)
  assert.equal(sumNutrition(a, { ...b, carbs: '30–20' }), null)
  assert.equal(sumNutrition(a, { ...b, calories: '-2' }), null)
})

test('new workspace backups retain independent recipe, side, shopping and cooking copies', () => {
  const content = importRecipe(template).content
  const recipe = { id: '00000000-0000-4000-8000-000000000001', markdown: contentMarkdown(content), content, source: template }
  const side = { id: 'side', name: 'Rice', portion: '100 g cooked', shopping: '200 g dry rice', nutrition: emptyNutrition() }
  const data = { ...emptyRecipes(), recipes: [{ ...recipe, source: 'Updated source' }], sides: [{ ...side, name: 'Updated side' }], plan: [{ id: 'meal', recipe, side }], shopping: { items: [], sources: [recipe], planned: ['meal'] }, cooking: { recipe, side, step: 1 } }
  assert.deepEqual(parseRecipeData(JSON.stringify(data)), data)
  assert.throws(() => parseRecipeData(JSON.stringify({ ...data, recipes: [{ ...recipe, markdown: '# Different content' }] })))
  assert.throws(() => parseRecipeData(JSON.stringify({ ...data, sides: [side, side] })))
  assert.throws(() => parseRecipeData(JSON.stringify({ ...data, plan: [data.plan[0], data.plan[0]] })))
  assert.throws(() => parseRecipeData(JSON.stringify({ ...data, cooking: { ...data.cooking, side: { ...side, nutrition: null } } })))
})

test('recipe save retries the same operation and rejects conflicts', async () => {
  const requests: Record<string, unknown>[] = []; let mode = 'failure'
  const client = { rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === 'tor_online_recipe_read') return { data: { revision: 0, data: null }, error: null }
    requests.push(args)
    if (mode === 'failure') return { data: null, error: Error('offline') }
    if (mode === 'conflict') return { data: { status: 'conflict' }, error: null }
    return { data: { status: 'ok', revision: Number(args.p_revision) + 1 }, error: null }
  } } as unknown as SupabaseClient
  const store = new OnlineRecipeStore(client, 'owner'); const statuses: string[] = []; store.onStatus = status => statuses.push(status)
  const data = await store.load()
  store.update({ ...data, recipes: [{ id: '00000000-0000-4000-8000-000000000001', markdown: template }] }); await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(statuses.at(-1), 'error')
  mode = 'ok'; store.retry(); await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(statuses.at(-1), 'saved'); assert.deepEqual(requests[0], requests[1])
  mode = 'conflict'; store.update({ ...data, shopping: { items: [] } }); await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(statuses.at(-1), 'conflict')
})
