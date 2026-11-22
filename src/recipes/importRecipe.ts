import { emptyContent, type Nutrition, type RecipeContent } from './model'

// Import is deliberately a draft: the original document remains attached to the recipe.
export function importRecipe(text: string): { content: RecipeContent; warnings: string[] } {
  const source = text.replace(/\r\n/g, '\n')
  const c = emptyContent()
  const warnings: string[] = []
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s) }
  if (source.trimStart().startsWith('{')) {
    const raw: unknown = JSON.parse(source)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Expected a recipe JSON object.')
    const r = raw as Record<string, unknown>
    const string = (key: string) => { if (r[key] !== undefined && typeof r[key] !== 'string') throw Error(`${key} must be text.`); return (r[key] as string) || '' }
    const list = (key: string) => { if (r[key] !== undefined && (!Array.isArray(r[key]) || !(r[key] as unknown[]).every(x => typeof x === 'string'))) throw Error(`${key} must be an array of text.`); return ((r[key] as string[]) || []).filter(x => x.trim()) }
    const n = r.nutrition
    if (n !== undefined && (!n || typeof n !== 'object' || Array.isArray(n))) throw Error('nutrition must be an object.')
    const nn = (n || {}) as Record<string, unknown>
    for (const key of Object.keys(c.nutrition) as (keyof Nutrition)[]) {
      if (nn[key] !== undefined && typeof nn[key] !== 'string') throw Error(`nutrition.${key} must be text.`)
      c.nutrition[key] = (nn[key] as string) || ''
    }
    Object.assign(c, { title: string('title'), description: string('description'), portions: string('portions'), quickGlance: string('quickGlance'), notes: string('notes'), fresh: list('fresh'), pantry: list('pantry'), steps: list('steps') })
    if (Object.keys(r).some(k => !['title', 'description', 'portions', 'nutrition', 'quickGlance', 'notes', 'fresh', 'pantry', 'steps'].includes(k))) warn('Some JSON fields are not mapped. The original is retained.')
    if (Object.keys(nn).some(k => !(k in c.nutrition))) warn('Additional nutrition fields remain in the original import.')
    if (!c.title.trim()) warn('Add a title before saving.')
    if (!c.fresh.length && !c.pantry.length) warn('No ingredients recognized.')
    if (!c.steps.length) warn('No instructions recognized.')
    return { content: c, warnings }
  }
  let section = '', group = 'fresh', current = -1, headingSteps = false, stepsDepth = 2, tableHeaders: string[] = [], fence = false
  const plain = (s: string) => s.replace(/\*\*/g, '').trim()
  const conflicts = new Set<keyof Nutrition>()
  const macro = (key: keyof Nutrition, value: string) => {
    const next = value.replace(/\s*(kcal|g)\s*$/i, '').trim()
    if (conflicts.has(key)) return
    if (c.nutrition[key] && c.nutrition[key] !== next) {
      conflicts.add(key); c.nutrition[key] = ''
      warn(`Conflicting ${key} values were left blank. Choose the intended per-portion value from the original.`)
    } else c.nutrition[key] = next
  }
  const readMacros = (text: string) => {
    const clean = plain(text)
    let foundAny = false
    for (const [key, regex] of [['calories', /([~≈]?[\d.]+(?:\s*[–-]\s*[\d.]+)?)\s*kcal/i], ['protein', /([~≈]?[\d.]+(?:\s*[–-]\s*[\d.]+)?)\s*g\s*protein/i], ['carbs', /([~≈]?[\d.]+(?:\s*[–-]\s*[\d.]+)?)\s*g\s*carb(?:s|ohydrates)?/i], ['fat', /([~≈]?[\d.]+(?:\s*[–-]\s*[\d.]+)?)\s*g\s*fat/i]] as const) {
      const found = clean.match(regex)?.[1]
      if (found) { macro(key, found); foundAny = true }
    }
    const labeled = clean.match(/^(calories|protein|carbs|carbohydrates|fat):\s*([~≈]?[\d.]+(?:\s*[–-]\s*[\d.]+)?)(?:\s*(?:kcal|g))?\s*$/i)
    if (labeled) { macro(labeled[1].toLowerCase() === 'carbohydrates' ? 'carbs' : labeled[1].toLowerCase() as keyof Nutrition, labeled[2]); foundAny = true }
    if (!foundAny && /:\s*\S/.test(clean)) warn('Some nutrition text was not mapped. Check the retained original.')
  }
  for (const line of source.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; warn('Code blocks remain in the original import; check their content.'); continue }
    if (fence) continue
    const h1 = line.match(/^#\s+(.+)/)
    if (h1 && !c.title) { c.title = h1[1].trim(); continue }
    const cleanLine = plain(line).replace(/^[-*+]\s+/, '')
    const serves = cleanLine.match(/^(?:serves|portions?|yield):\s*(.+)/i)
    if (serves) { c.portions = serves[1].trim(); if (/curry only/i.test(c.portions)) c.nutrition.scope = 'curry only'; continue }
    if (/^(?:macros per portion|per serving|per portion|nutritional breakdown|nutrition:)/i.test(cleanLine)) { readMacros(cleanLine); const scope = cleanLine.match(/\(([^)]+)\)/)?.[1]; if (scope) c.nutrition.scope = scope; if (/curry only/i.test(cleanLine)) c.nutrition.scope = 'curry only'; continue }
    const heading = line.match(/^(#{2,4})\s+(.+)/) || line.match(/^()(Ingredients|Instructions|Nutrition|Notes):?\s*$/i)
    if (heading) {
      const h = heading[2].toLowerCase()
      tableHeaders = []
      if (section === 'steps' && heading[1].length > stepsDepth) {
        if (heading[1].length > stepsDepth + 1 && current >= 0) c.steps[current] += `\n${line}`
        else { c.steps.push(heading[2].replace(/^(?:step\s+)?\d+[.)]?\s+/i, '')); current = c.steps.length - 1; headingSteps = true }
        continue
      }
      if (/pantry|shelf|fresh|weekly groceries/.test(h)) { section = 'ingredients'; group = /pantry|shelf/i.test(h) ? 'pantry' : 'fresh'; continue }
      if (/ingredients/.test(h)) { section = 'ingredients'; group = 'fresh'; continue }
      if (/(instructions|method|directions)/.test(h)) { section = 'steps'; headingSteps = false; stepsDepth = heading[1].length; continue }
      if (/(portions?|nutrition|macros)/.test(h)) { section = 'nutrition'; continue }
      if (/quick glance/.test(h)) { section = 'quick'; continue }
      if (/(notes|tips|meal prep|time.*tools)/.test(h)) { section = 'notes'; c.notes += `${c.notes ? '\n\n' : ''}${line}\n`; continue }
      warn('Some headings were not mapped. Check the retained original.')
      section = ''; continue
    }
    if (/^\s*---+\s*$/.test(line)) continue
    if (!line.trim()) { if (section === 'steps' && current >= 0) c.steps[current] += '\n'; continue }
    if (/^\s*\|/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(plain)
      if (cells.every(cell => /^:?-+:?$/.test(cell))) continue
      if (!tableHeaders.length) { tableHeaders = cells.map(v => v.toLowerCase()); continue }
      if (section === 'ingredients') {
        const name = tableHeaders.findIndex(v => /^(ingredient|item)s?$/.test(v)), quantity = tableHeaders.findIndex(v => /quantity|amount/.test(v)), notes = tableHeaders.findIndex(v => v === 'notes')
        if (name >= 0 && quantity >= 0 && cells[name] && cells[quantity]) {
          (group === 'pantry' ? c.pantry : c.fresh).push(`${cells[name]} — ${cells[quantity]}${notes >= 0 && cells[notes] ? ` · ${cells[notes]}` : ''}`)
          if (tableHeaders.some(v => /calories|protein|fat|carbs|cost/.test(v))) warn('Ingredient calculation and cost columns are kept in the original import only.')
        } else warn('Some ingredient table rows were not mapped. Check the retained original.')
      } else if (section === 'nutrition') {
        const key = /calories|energy/i.test(cells[0]) ? 'calories' : /protein/i.test(cells[0]) ? 'protein' : /carb/i.test(cells[0]) ? 'carbs' : /^fat$/i.test(cells[0]) ? 'fat' : null
        const portionColumn = tableHeaders.findIndex(v => /per (?:portion|serving)/.test(v))
        const column = portionColumn >= 0 ? portionColumn : tableHeaders.length === 2 && !tableHeaders.some(v => /total|batch/.test(v)) ? 1 : -1
        if (key && column >= 0 && cells[column]) macro(key, cells[column])
        else warn('Additional nutrition rows remain in the original import.')
      } else warn('Some tables remain in the original import only.')
      continue
    }
    if (section === 'nutrition') {
      if (/kcal|g\s+(protein|carbs|fat)|^(calories|protein|carbs|carbohydrates|fat):/i.test(cleanLine)) readMacros(cleanLine)
      else { c.notes += `${c.notes ? '\n' : ''}${line}`; warn('Nutrition notes were moved to Notes; check their scope.') }
    } else if (section === 'ingredients') {
      const item = line.match(/^\s*[-*+]\s+(.+)/)
      if (item) (group === 'pantry' ? c.pantry : c.fresh).push(item[1].trim())
      else warn('Some ingredient content was not mapped. Check the retained original.')
    } else if (section === 'steps') {
      const step = line.match(/^\d+[.)]\s+(.+)/) || line.match(/^[-*+]\s+([^:]+:)\s*$/)
      if (step && !headingSteps) { c.steps.push(step[1].trim()); current = c.steps.length - 1 }
      else if (current >= 0) c.steps[current] += `\n${headingSteps ? line : line.replace(/^ {3}/, '')}`
      else warn('Some instructions were not mapped. Check the retained original.')
    } else if (section === 'quick') c.quickGlance += `${c.quickGlance ? '\n' : ''}${line}`
    else if (section === 'notes') c.notes += `${c.notes ? '\n' : ''}${line}`
    else if (!c.description && !line.startsWith('#')) c.description = line
    else warn('Some text was not mapped. Check the retained original.')
  }
  c.steps = c.steps.map(s => s.trim())
  if (!c.title) warn('Add a title before saving.')
  if (!c.fresh.length && !c.pantry.length) warn('No ingredients recognized.')
  if (!c.steps.length) warn('No instructions recognized.')
  return { content: c, warnings }
}

export function sumNutrition(a: Nutrition, b: Nutrition): Nutrition | null {
  const sum = (left: string, right: string) => {
    const parse = (v: string) => {
      const match = v.trim().match(/^(~|≈)?\s*(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?$/)
      return match ? { min: Number(match[2]), max: Number(match[3] || match[2]), approx: !!match[1] } : null
    }
    const x = parse(left), y = parse(right)
    if (!x || !y || x.max < x.min || y.max < y.min) return null
    const format = (n: number) => String(Math.round(n * 100) / 100)
    const min = format(x.min + y.min), max = format(x.max + y.max)
    return `${x.approx || y.approx ? '~' : ''}${min}${min !== max ? `–${max}` : ''}`
  }
  const calories = sum(a.calories, b.calories), protein = sum(a.protein, b.protein), carbs = sum(a.carbs, b.carbs), fat = sum(a.fat, b.fat)
  return calories && protein && carbs && fat ? { scope: 'per meal', calories, protein, carbs, fat } : null
}
