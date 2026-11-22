import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { emptyRecipes, parseMarkdown, parseRecipeData, template } from '../src/recipes/model'
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

test('workspace validation keeps phase snapshots and rejects invalid data', () => {
  const recipe = { id: '00000000-0000-4000-8000-000000000001', markdown: template }
  const data = { ...emptyRecipes(), recipes: [recipe], cooking: { recipe, step: 1 } }
  assert.deepEqual(parseRecipeData(JSON.stringify(data)), data)
  assert.throws(() => parseRecipeData(JSON.stringify({ ...data, cooking: { recipe, step: 4 } })))
  assert.throws(() => parseRecipeData(JSON.stringify({ ...data, recipes: [recipe, recipe] })))
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
