import { WORKSPACE_LIMIT, utf8Bytes } from '../backupLimits'

export type Nutrition = { scope: string; calories: string; protein: string; carbs: string; fat: string }
export type RecipeContent = { title: string; description: string; portions: string; nutrition: Nutrition; quickGlance: string; fresh: string[]; pantry: string[]; steps: string[]; notes: string }
export type Recipe = { id: string; markdown: string; content?: RecipeContent; source?: string; importWarnings?: string[] }
export type Side = { id: string; name: string; portion: string; shopping: string; nutrition: Nutrition }
export type PlannedMeal = { id: string; recipe: Recipe; side?: Side }
export type ShoppingItem = { id: string; recipe: string; text: string; pantry: boolean; state: 'needed' | 'have' | 'bought' }
export type RecipeMeta = { idea: boolean; archived: boolean; rotation: boolean; lastPrepared?: string }
export type RecipeData = { version: 3; recipes: Recipe[]; shopping: { items: ShoppingItem[]; sources?: Recipe[]; planned?: string[] } | null; cooking: { recipe: Recipe; step: number; side?: Side } | null; meta: Record<string, RecipeMeta>; sides: Side[]; plan: PlannedMeal[] }
export const emptyRecipes = (): RecipeData => ({ version: 3, recipes: [], shopping: null, cooking: null, meta: {}, sides: [], plan: [] })

export const emptyNutrition = (): Nutrition => ({ scope: '', calories: '', protein: '', carbs: '', fat: '' })
export const emptyContent = (): RecipeContent => ({ title: '', description: '', portions: '', nutrition: emptyNutrition(), quickGlance: '', fresh: [], pantry: [], steps: [], notes: '' })
export function nutritionText(n: Nutrition) {
  return [n.calories && `${n.calories} kcal`, n.protein && `${n.protein} g protein`, n.carbs && `${n.carbs} g carbs`, n.fat && `${n.fat} g fat`].filter(Boolean).join(' · ')
}
export function recipeView(recipe: Recipe) {
  if (!recipe.content) return parseMarkdown(recipe.markdown)
  const c = recipe.content
  return { title: c.title, portions: c.portions, macros: nutritionText(c.nutrition), quickGlance: c.quickGlance, ingredients: [...c.fresh.map(text => ({ text, pantry: false })), ...c.pantry.map(text => ({ text, pantry: true }))], steps: c.steps, warnings: recipe.importWarnings || [] }
}
export function contentMarkdown(c: RecipeContent) {
  return [`# ${c.title}`, c.description, c.portions && `Portions: ${c.portions}`, nutritionText(c.nutrition) && `Macros per portion${c.nutrition.scope ? ` (${c.nutrition.scope})` : ''}: ${nutritionText(c.nutrition)}`, c.quickGlance && `## Quick glance\n${c.quickGlance}`, c.fresh.length && `## Ingredients\n${c.fresh.map(s => `- ${s}`).join('\n')}`, c.pantry.length && `## Pantry\n${c.pantry.map(s => `- ${s}`).join('\n')}`, c.steps.length && `## Instructions\n${c.steps.map((s, i) => `${i + 1}. ${s.replace(/\n/g, '\n   ')}`).join('\n\n')}`, c.notes && `## Notes\n${c.notes}`].filter(Boolean).join('\n\n')
}

export const template = `# 🥣 Recipe name

Portions: 4
Macros per portion: 450 kcal · 30 g protein · 50 g carbs · 15 g fat

## Quick glance
- Press tofu, then prepare rice and vegetables.
- Cook everything and divide into 4 portions.

## Ingredients
- 400 g tofu
- 200 g rice

## Pantry
- 10 g oil

## Instructions
1. Prepare the ingredients.
2. Cook and divide into four portions.

## Notes
Add any notes or add-ons here.`

export function parseMarkdown(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const title = lines.find(line => /^#\s+\S/.test(line))?.replace(/^#\s+/, '').trim() || ''
  const field = (name: string) => lines.map(line => line.match(new RegExp(`^\\s*(?:\\*\\*)?${name}(?:\\*\\*)?:\\s*(.+)$`, 'i'))).find(Boolean)?.[1]?.trim() || ''
  const ingredients: { text: string; pantry: boolean }[] = []; const steps: string[] = []; const quickGlance: string[] = []; const warnings: string[] = []
  const warn = (message: string) => { if (!warnings.includes(message)) warnings.push(message) }
  let section = ''; let inFence = false
  for (const line of lines) {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(line)) { inFence = !inFence; if (section === 'quick glance') quickGlance.push(line); else if (['ingredients', 'pantry', 'instructions'].includes(section)) warn(`Code blocks in ${section} are not extracted.`); continue }
    if (inFence) { if (section === 'quick glance') quickGlance.push(line); continue }
    const heading = line.match(/^##\s+(.+?)\s*#*\s*$/)
    if (heading) { section = heading[1].trim().toLowerCase(); continue }
    if (section === 'quick glance') { quickGlance.push(line); continue }
    if (!line.trim()) continue
    const item = line.match(/^\s*[-*+]\s+(.+\S|\S)\s*$/)
    if (item && (section === 'ingredients' || section === 'pantry')) {
      ingredients.push({ text: item[1].trim(), pantry: section === 'pantry' })
      if (/^\s/.test(line)) warn(`Indented ${section} bullets were extracted as separate items. Check the full recipe.`)
    }
    else if (section === 'ingredients' || section === 'pantry') warn(`Some ${section} lines were not extracted. Check the full recipe.`)
    const step = line.match(/^\s*\d+[.)]\s+(.+\S|\S)\s*$/)
    if (step && section === 'instructions') { steps.push(step[1].trim()); if (/^\s/.test(line)) warn('Indented numbered instruction lines were extracted as separate steps. Check the full recipe.') }
    else if (section === 'instructions') {
      if (steps.length && /^\s{2,}\S/.test(line)) { steps[steps.length - 1] += `\n${line.trim()}`; warn('Indented instruction content was kept in the preceding step; check its structure.') }
      else warn('Some instruction lines were not extracted. Check the full recipe.')
    }
  }
  return { title, portions: field('Portions'), macros: field('Macros per portion'), ingredients, steps, quickGlance: quickGlance.join('\n').trim(), warnings }
}

export function parseRecipeData(input: string): RecipeData {
  if (utf8Bytes(input) > WORKSPACE_LIMIT) throw Error('Recipe data is too large')
  const value: unknown = JSON.parse(input)
  const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
  const nutrition = (x: unknown): x is Nutrition => obj(x) && ['scope', 'calories', 'protein', 'carbs', 'fat'].every(k => typeof x[k] === 'string')
  const content = (x: unknown): x is RecipeContent => obj(x) && ['title', 'description', 'portions', 'quickGlance', 'notes'].every(k => typeof x[k] === 'string') && typeof x.title === 'string' && !!x.title.trim() && nutrition(x.nutrition) && ['fresh', 'pantry', 'steps'].every(k => Array.isArray(x[k]) && (x[k] as unknown[]).every(v => typeof v === 'string' && !!v.trim()))
  const recipe = (x: unknown): x is Recipe => obj(x) && typeof x.id === 'string' && /^[0-9a-f-]{36}$/i.test(x.id) && typeof x.markdown === 'string' && !!parseMarkdown(x.markdown).title && (x.source === undefined || typeof x.source === 'string') && (x.importWarnings === undefined || (Array.isArray(x.importWarnings) && x.importWarnings.every(w => typeof w === 'string'))) && (x.content === undefined || (content(x.content) && x.markdown === contentMarkdown(x.content)))
  const side = (x: unknown): x is Side => obj(x) && typeof x.id === 'string' && typeof x.name === 'string' && !!x.name.trim() && typeof x.portion === 'string' && typeof x.shopping === 'string' && nutrition(x.nutrition)
  if (!obj(value) || (value.version !== 1 && value.version !== 2 && value.version !== 3) || !Array.isArray(value.recipes) || !value.recipes.every(recipe) || new Set(value.recipes.map(r => r.id)).size !== value.recipes.length) throw Error('Invalid recipes')
  if (value.shopping !== null && (!obj(value.shopping) || !Array.isArray(value.shopping.items) || !value.shopping.items.every((i: unknown) => obj(i) && typeof i.id === 'string' && typeof i.recipe === 'string' && typeof i.text === 'string' && typeof i.pantry === 'boolean' && ['needed', 'have', 'bought'].includes(String(i.state))))) throw Error('Invalid shopping')
  if (obj(value.shopping) && value.shopping.sources !== undefined && (!Array.isArray(value.shopping.sources) || !value.shopping.sources.every(recipe) || new Set(value.shopping.sources.map(r => r.id)).size !== value.shopping.sources.length)) throw Error('Invalid shopping sources')
  if (obj(value.shopping) && value.shopping.planned !== undefined && (!Array.isArray(value.shopping.planned) || !value.shopping.planned.every(id => typeof id === 'string') || new Set(value.shopping.planned).size !== value.shopping.planned.length)) throw Error('Invalid planned shopping sources')
  if (value.cooking !== null && (!obj(value.cooking) || !recipe(value.cooking.recipe) || (value.cooking.side !== undefined && !side(value.cooking.side)) || !Number.isInteger(value.cooking.step) || (value.cooking.step as number) < 0 || (value.cooking.step as number) >= Math.max(1, recipeView(value.cooking.recipe).steps.length))) throw Error('Invalid cooking')
  if (value.version !== 1 && (!obj(value.meta) || !Object.values(value.meta).every(m => obj(m) && typeof m.idea === 'boolean' && typeof m.archived === 'boolean' && typeof m.rotation === 'boolean' && (m.lastPrepared === undefined || typeof m.lastPrepared === 'string')))) throw Error('Invalid recipe metadata')
  if (value.version !== 3) return { ...emptyRecipes(), recipes: value.recipes, shopping: value.shopping, cooking: value.cooking, meta: value.version === 2 ? value.meta : {} } as RecipeData
  if (!Array.isArray(value.sides) || !value.sides.every(side) || new Set(value.sides.map(s => s.id)).size !== value.sides.length) throw Error('Invalid sides')
  if (!Array.isArray(value.plan) || !value.plan.every(p => obj(p) && typeof p.id === 'string' && recipe(p.recipe) && (p.side === undefined || side(p.side))) || new Set(value.plan.map(p => p.id)).size !== value.plan.length) throw Error('Invalid meal plan')
  return value as RecipeData
}
