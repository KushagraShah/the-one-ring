export type Recipe = { id: string; markdown: string }
export type ShoppingItem = { id: string; recipe: string; text: string; pantry: boolean; state: 'needed' | 'have' | 'bought' }
export type RecipeData = { version: 1; recipes: Recipe[]; shopping: { items: ShoppingItem[] } | null; cooking: { recipe: Recipe; step: number } | null }
export const emptyRecipes = (): RecipeData => ({ version: 1, recipes: [], shopping: null, cooking: null })

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
  const ingredients: { text: string; pantry: boolean }[] = []; const steps: string[] = []; const quickGlance: string[] = []
  let section = ''; let inFence = false
  for (const line of lines) {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(line)) { inFence = !inFence; if (section === 'quick glance') quickGlance.push(line); continue }
    if (inFence) { if (section === 'quick glance') quickGlance.push(line); continue }
    const heading = line.match(/^##\s+(.+?)\s*#*\s*$/)
    if (heading) { section = heading[1].trim().toLowerCase(); continue }
    if (section === 'quick glance') quickGlance.push(line)
    const item = line.match(/^\s*[-*+]\s+(.+\S|\S)\s*$/)
    if (item && (section === 'ingredients' || section === 'pantry')) ingredients.push({ text: item[1].trim(), pantry: section === 'pantry' })
    const step = line.match(/^\s*\d+[.)]\s+(.+\S|\S)\s*$/)
    if (step && section === 'instructions') steps.push(step[1].trim())
    else if (section === 'instructions' && steps.length && /^\s{2,}\S/.test(line)) steps[steps.length - 1] += `\n${line.trim()}`
  }
  return { title, portions: field('Portions'), macros: field('Macros per portion'), ingredients, steps, quickGlance: quickGlance.join('\n').trim() }
}

export function parseRecipeData(input: string): RecipeData {
  if (new TextEncoder().encode(input).length > 10_000_000) throw Error('Recipe data is too large')
  const value: unknown = JSON.parse(input)
  const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
  const recipe = (x: unknown): x is Recipe => obj(x) && typeof x.id === 'string' && /^[0-9a-f-]{36}$/i.test(x.id) && typeof x.markdown === 'string' && !!parseMarkdown(x.markdown).title
  if (!obj(value) || value.version !== 1 || !Array.isArray(value.recipes) || !value.recipes.every(recipe) || new Set(value.recipes.map(r => r.id)).size !== value.recipes.length) throw Error('Invalid recipes')
  if (value.shopping !== null && (!obj(value.shopping) || !Array.isArray(value.shopping.items) || !value.shopping.items.every((i: unknown) => obj(i) && typeof i.id === 'string' && typeof i.recipe === 'string' && typeof i.text === 'string' && typeof i.pantry === 'boolean' && ['needed', 'have', 'bought'].includes(String(i.state))))) throw Error('Invalid shopping')
  if (value.cooking !== null && (!obj(value.cooking) || !recipe(value.cooking.recipe) || !Number.isInteger(value.cooking.step) || (value.cooking.step as number) < 0 || (value.cooking.step as number) >= Math.max(1, parseMarkdown(value.cooking.recipe.markdown).steps.length))) throw Error('Invalid cooking')
  return value as RecipeData
}
