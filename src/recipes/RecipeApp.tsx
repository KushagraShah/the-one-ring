import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDownToLine, RotateCcw } from 'lucide-react'
import { confirmAction, showMessage } from '../AppDialog'
import { supabase } from '../auth'
import { emptyRecipes, parseMarkdown, parseRecipeData, template, type Recipe, type RecipeData, type ShoppingItem } from './model'
import { OnlineRecipeStore, type SaveStatus } from './online'
import { CookingPhase, CookingPicker, ShoppingList } from './RecipePhases'
import { RecipeDetail } from './RecipeDetail'
import { RecipeEditor } from './RecipeEditor'
import { RecipeRecovery } from './RecipeRecovery'
import { ShoppingItemEditor, ShoppingRecipePicker } from './ShoppingDialogs'
import './recipes.css'

type Props = { identity: { id: string; demo: boolean }; view: string; exportWorkout: () => void; exportHabits: () => void }
export type RecipeHandle = { canLeave: () => boolean; leave: (done: () => void) => void; exportData: () => void; snapshot: () => RecipeData | null; replace: (data: RecipeData) => void }
const example = `# 🍲 Tofu rice bowl\n\nPortions: 4\nMacros per portion: Example values only\n\n## Quick glance\n- Prepare tofu and vegetables.\n- Cook the rice and vegetables.\n- Divide into four portions.\n\n## Ingredients\n- 400 g tofu\n- 200 g rice\n- 300 g vegetables\n\n## Pantry\n- 10 g oil\n\n## Instructions\n1. Prepare the vegetables and tofu.\n2. Cook the rice and vegetables.\n3. Divide into four portions.\n\n## Notes\nFictional demo recipe.`
function download(data: RecipeData) {
  const blob = new Blob([JSON.stringify({ scope: 'recipes', format: 1, data }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `one-ring-recipes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; a.click(); URL.revokeObjectURL(url)
}
function downloadDrafts(drafts: { recipeMarkdown?: string; shoppingItem?: string; editedShoppingItem?: string }) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ scope: 'recipe-text-drafts', format: 1, ...drafts }, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = `one-ring-recipe-drafts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; a.click(); URL.revokeObjectURL(url)
}

export const RecipeApp = forwardRef<RecipeHandle, Props>(function RecipeApp({ identity, view, exportWorkout, exportHabits }, ref) {
  const [data, setData] = useState<RecipeData | null>(() => identity.demo ? { ...emptyRecipes(), recipes: [{ id: crypto.randomUUID(), markdown: example }] } : null)
  const [store, setStore] = useState<OnlineRecipeStore | null>(null)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [loadError, setLoadError] = useState(false); const [attempt, setAttempt] = useState(0)
  const [tab, setTab] = useState<'recipes' | 'shopping' | 'cooking'>('recipes')
  const [selected, setSelected] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ id: string | null; markdown: string; original: string } | null>(null)
  const [review, setReview] = useState(false); const [search, setSearch] = useState('')
  const [shoppingSelection, setShoppingSelection] = useState<string[]>([])
  const [manualItem, setManualItem] = useState('')
  const [shoppingPicker, setShoppingPicker] = useState(false)
  const [itemEdit, setItemEdit] = useState<{ id: string; text: string; original: string } | null>(null)
  const dataRef = useRef(data); dataRef.current = data
  const recipeTrigger = useRef<HTMLButtonElement | null>(null)
  const editorTrigger = useRef<HTMLButtonElement | null>(null)
  const dirty = !!editor && editor.markdown !== editor.original
  const itemDirty = !!itemEdit && itemEdit.text !== itemEdit.original
  const hasPendingItem = !!manualItem.trim()
  useEffect(() => {
    if (identity.demo) return
    if (!supabase) { setLoadError(true); return }
    let active = true; const next = new OnlineRecipeStore(supabase, identity.id); setLoadError(false)
    next.load().then(result => { if (active) { setData(result); setStore(next) } }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [identity.id, identity.demo, attempt])
  useLayoutEffect(() => { if (!store) return; store.onStatus = setStatus; return () => { store.onStatus = () => {} } }, [store])
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty || itemDirty || hasPendingItem || status !== 'saved') event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty, itemDirty, hasPendingItem, status])
  const closeEditor = async (restoreFocus = false) => { if (dirty && !await confirmAction('Discard unsaved recipe edits?', 'Discard changes')) return false; setEditor(null); setReview(false); if (restoreFocus && !selected) requestAnimationFrame(() => editorTrigger.current?.focus()); return true }
  const closeItemEditor = async () => { if (itemDirty && !await confirmAction('Discard unsaved shopping item changes?', 'Discard changes')) return false; setItemEdit(null); return true }
  useImperativeHandle(ref, () => ({ canLeave: () => !dirty && !itemDirty && !hasPendingItem && status === 'saved', leave: async done => { if (await closeEditor() && await closeItemEditor()) done() }, exportData: () => { if (dataRef.current) download(dataRef.current) }, snapshot: () => dataRef.current, replace: next => update(next) }))
  const update = (next: RecipeData) => { const validated = parseRecipeData(JSON.stringify(next)); dataRef.current = validated; setData(validated); store?.update(validated) }
  const switchTab = async (next: typeof tab) => { if (editor && !await closeEditor()) return; setSelected(null); setTab(next) }
  const saveRecipe = () => {
    if (!editor || !data) return
    const parsed = parseMarkdown(editor.markdown)
    if (!parsed.title) { void showMessage('Add a title using # Recipe name before saving.'); return }
    const recipe = { id: editor.id || crypto.randomUUID(), markdown: editor.markdown }
    update({ ...data, recipes: editor.id ? data.recipes.map(r => r.id === editor.id ? recipe : r) : [...data.recipes, recipe] })
    setEditor(null); setReview(false); setSelected(recipe.id)
  }
  const beginCooking = async (recipe: Recipe) => {
    if (!dataRef.current) return
    if (dataRef.current.cooking && !await confirmAction('Replace the current cooking phase and discard its progress? The new phase starts at the first step.', 'Restart cooking')) return
    const current = dataRef.current
    if (!current || !current.recipes.some(item => item.id === recipe.id && item.markdown === recipe.markdown)) { void showMessage('The saved recipe changed. Open it again before starting cooking.'); return }
    update({ ...current, cooking: { recipe: { ...recipe }, step: 0 } }); setTab('cooking'); setSelected(null)
  }
  const addShoppingRecipes = async (ids: string[]) => {
    const initial = dataRef.current
    if (!initial || !ids.length) return
    const selectedRecipes = initial.recipes.filter(r => ids.includes(r.id) && !initial.shopping?.sources?.some(source => source.id === r.id))
    const needsReview = selectedRecipes.filter(recipe => { const parsed = parseMarkdown(recipe.markdown); return !parsed.ingredients.length || parsed.warnings.some(w => /ingredients|pantry/.test(w)) })
    if (needsReview.length && !await confirmAction(`Some ingredients may not be extracted for: ${needsReview.map(r => parseMarkdown(r.markdown).title).join(', ')}. Compare with the full recipes. Add only recognized items?`, 'Add recognized items')) return
    const current = dataRef.current
    if (!current) return
    const latest = selectedRecipes.filter(recipe => current.recipes.some(r => r.id === recipe.id && r.markdown === recipe.markdown) && !current.shopping?.sources?.some(source => source.id === recipe.id))
    if (latest.length !== selectedRecipes.length) { void showMessage('A selected recipe or shopping list changed. Review your selection and try again.'); return }
    const items = latest.flatMap(r => { const parsed = parseMarkdown(r.markdown); return parsed.ingredients.map(i => ({ ...i, id: crypto.randomUUID(), recipe: parsed.title, state: 'needed' as const })) })
    if (!items.length) { void showMessage('No ingredient bullets were recognized. Edit the recipes and review the Ingredients and Pantry sections first.'); return }
    const sources = current.shopping ? current.shopping.sources && [...current.shopping.sources, ...latest] : latest
    update({ ...current, shopping: { items: [...(current.shopping?.items || []), ...items], ...(sources ? { sources } : {}) } }); setShoppingSelection([]); setShoppingPicker(false)
  }
  const changeItem = (id: string, state: ShoppingItem['state']) => { const current = dataRef.current; if (current?.shopping) update({ ...current, shopping: { ...current.shopping, items: current.shopping.items.map(item => item.id === id ? { ...item, state } : item) } }) }
  const restore = async (file?: File) => {
    if (!file || !data) return
    try {
      if (file.size > 10_000_000) throw Error('Too large')
      const value = JSON.parse(await file.text()); if (value.scope !== 'recipes' || value.format !== 1) throw Error('Wrong scope')
      const next = parseRecipeData(JSON.stringify(value.data))
      if (await confirmAction('Replace all recipe data and active recipe phases with this backup? Workouts and habits will not change.', 'Restore recipes')) { update(next); setEditor(null); setSelected(null) }
    } catch { void showMessage('Invalid recipe backup. No recipe data was replaced.') }
  }
  const active = data?.recipes.find(r => r.id === selected)
  const cookingSource = data?.cooking && data.recipes.find(recipe => recipe.id === data.cooking?.recipe.id)
  const cookingNotice = !data?.cooking ? '' : !cookingSource ? 'The saved recipe was deleted. This cooking phase keeps the original copy.' : cookingSource.markdown !== data.cooking.recipe.markdown ? 'The saved recipe changed. This cooking phase still uses the original copy.' : ''
  const shoppingNotice = !data?.shopping ? '' : !data.shopping.sources ? 'This older shopping list does not contain source snapshots; check the saved recipes for changes.' : data.shopping.sources.some(source => { const current = data.recipes.find(recipe => recipe.id === source.id); return !current || current.markdown !== source.markdown }) ? 'A saved recipe changed or was deleted. This list keeps its original items and states; review the saved recipe before shopping.' : ''
  const closeRecipe = () => { setSelected(null); requestAnimationFrame(() => recipeTrigger.current?.focus()) }
  return <>
    {status === 'saving' && <div role="status" className="habit-saving">Saving recipes…</div>}
    <div hidden={view !== 'recipes'} className="recipe-app">
      <header className="recipe-heading"><span>THE KITCHEN BOOK</span><h1>Recipe Book<span>✳</span></h1><p>Plan your shop. Cook at your pace.</p></header>
      {identity.demo && <p className="recipe-notice">Demo · Fictional example. Changes reset on refresh.</p>}
      {!data ? <div className="recipe-panel">{loadError ? <><h2>Recipes unavailable</h2><p>Check your connection. Signed-in recipes also require the new recipe database migration; it has not been applied by this preview.</p><button onClick={() => setAttempt(n => n + 1)}>Retry</button></> : <p>Loading recipes…</p>}</div> : <>
        <nav className="recipe-tabs" aria-label="Recipe Book"><button aria-current={tab === 'recipes' ? 'page' : undefined} onClick={() => void switchTab('recipes')}>Recipes</button><button aria-current={tab === 'shopping' ? 'page' : undefined} onClick={() => void switchTab('shopping')}>Shopping{data.shopping ? ' •' : ''}</button><button aria-current={tab === 'cooking' ? 'page' : undefined} onClick={() => void switchTab('cooking')}>Cooking{data.cooking ? ' •' : ''}</button></nav>
          {tab === 'recipes' && <><div className="recipe-toolbar"><label>Search recipes<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or ingredient"/></label><button className="recipe-primary" onClick={event => { editorTrigger.current = event.currentTarget; setEditor({ id: null, markdown: template, original: template }) }}>+ Add recipe</button></div><div className="recipe-list">{data.recipes.filter(r => r.markdown.toLowerCase().includes(search.toLowerCase())).map(r => { const p = parseMarkdown(r.markdown); return <button className="recipe-card" key={r.id} onClick={event => { recipeTrigger.current = event.currentTarget; setSelected(r.id) }}><span className="recipe-card-icon">✳</span><span><strong>{p.title}</strong><small>{p.portions ? `${p.portions} portions` : 'Portions not specified'}</small><small>{p.macros || 'No macro summary'}</small></span><span aria-hidden="true">→</span></button> })}{!data.recipes.length && <p>Your recipe book is empty. Add your first recipe to get started.</p>}</div>{active && !editor && <RecipeDetail recipe={active} close={closeRecipe} edit={() => setEditor({ id: active.id, markdown: active.markdown, original: active.markdown })} start={() => void beginCooking(active)} remove={() => { void (async () => { if (await confirmAction('Delete this recipe? Active shopping and cooking phases keep their snapshots.', 'Delete recipe')) { update({ ...data, recipes: data.recipes.filter(r => r.id !== active.id) }); setSelected(null) } })() }}/> }</>}
          {tab === 'shopping' && (data.shopping ? <ShoppingList items={data.shopping.items} changeItem={changeItem} manualItem={manualItem} setManualItem={setManualItem} sourceNotice={shoppingNotice} addRecipes={() => setShoppingPicker(true)} editItem={item => setItemEdit({ id: item.id, text: item.text, original: item.text })} removeItem={item => { void (async () => { if (!await confirmAction(`Remove ${item.text} from this shopping list? The saved recipe will not change.`, 'Remove item')) return; const current = dataRef.current; if (current?.shopping) update({ ...current, shopping: { ...current.shopping, items: current.shopping.items.filter(i => i.id !== item.id) } }) })() }} addItem={() => { if (!manualItem.trim() || !data.shopping) return; update({ ...data, shopping: { ...data.shopping, items: [...data.shopping.items, { id: crypto.randomUUID(), text: manualItem.trim(), recipe: 'Added item', pantry: false, state: 'needed' }] } }); setManualItem('') }} end={() => { void (async () => { const current = dataRef.current; if (!current?.shopping) return; const remaining = current.shopping.items.filter(item => item.state === 'needed').length; const draftNotice = manualItem.trim() ? ' The unadded item text will also be discarded.' : ''; if (await confirmAction(`End shopping and clear this checklist? ${remaining} items are still marked Need.${draftNotice}`, 'End shopping')) { const latest = dataRef.current; if (latest?.shopping) update({ ...latest, shopping: null }); setManualItem('') } })() }}/> : <section className="recipe-panel"><span className="recipe-kicker">SHOPPING</span><h2>Choose recipes</h2><p>Select recipes to build a checklist. Nothing changes in your saved recipes. Compare the extracted items with the full recipes.</p>{data.recipes.map(r => <label className="recipe-select" key={r.id}><input type="checkbox" checked={shoppingSelection.includes(r.id)} onChange={e => setShoppingSelection(e.target.checked ? [...shoppingSelection, r.id] : shoppingSelection.filter(id => id !== r.id))}/>{parseMarkdown(r.markdown).title}</label>)}{!data.recipes.length && <p>Add a recipe first.</p>}<button className="recipe-primary" disabled={!shoppingSelection.length} onClick={() => void addShoppingRecipes(shoppingSelection)}>Start shopping</button></section>)}
          {tab === 'cooking' && (data.cooking ? <CookingPhase recipe={data.cooking.recipe} step={data.cooking.step} sourceNotice={cookingNotice} restart={cookingNotice && cookingSource ? () => void beginCooking(cookingSource) : undefined} move={step => { if (data.cooking) update({ ...data, cooking: { ...data.cooking, step } }) }} finish={() => { void (async () => { if (await confirmAction('End this cooking phase? The saved recipe will not change.', 'Finish cooking')) { const current = dataRef.current; if (current) update({ ...current, cooking: null }) } })() }}/> : <CookingPicker recipes={data.recipes} start={recipe => void beginCooking(recipe)}/>)}
          {shoppingPicker && data.shopping && <ShoppingRecipePicker recipes={data.recipes} current={data.shopping.sources?.map(source => source.id) || []} close={() => setShoppingPicker(false)} add={ids => void addShoppingRecipes(ids)}/>}
          {itemEdit && <ShoppingItemEditor text={itemEdit.text} change={text => setItemEdit({ ...itemEdit, text })} save={() => { const current = dataRef.current; if (!current?.shopping || !itemEdit.text.trim()) return; update({ ...current, shopping: { ...current.shopping, items: current.shopping.items.map(item => item.id === itemEdit.id ? { ...item, text: itemEdit.text.trim() } : item) } }); setItemEdit(null) }} close={() => void closeItemEditor()}/>}
          {editor && <RecipeEditor editor={editor} review={review} change={markdown => setEditor({ ...editor, markdown })} setReview={setReview} close={() => void closeEditor(true)} save={saveRecipe}/>}
      </>}
    </div>
    <div hidden={view !== 'settings'}>{data && <div className="settings-card backup-card"><h3>Recipe backup</h3><p>Recipes and active phases only. The existing workout/habit backup does not include recipes in this preview.</p><div className="settings-actions"><button className="outline-button" onClick={() => download(data)}><ArrowDownToLine size={16} aria-hidden="true"/> Export recipes</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore recipes<input type="file" accept="application/json,.json" onChange={e => { void restore(e.target.files?.[0]); e.target.value = '' }}/></label></div></div>}</div>
    {(status === 'error' || status === 'conflict') && <RecipeRecovery status={status} retry={() => store?.retry()} exportRecipes={() => { if (dataRef.current) download(dataRef.current) }} exportDrafts={dirty || itemDirty || hasPendingItem ? () => downloadDrafts({ ...(dirty ? { recipeMarkdown: editor!.markdown } : {}), ...(hasPendingItem ? { shoppingItem: manualItem } : {}), ...(itemDirty ? { editedShoppingItem: itemEdit!.text } : {}) }) : undefined} exportWorkout={exportWorkout} exportHabits={exportHabits}/>}
  </>
})
