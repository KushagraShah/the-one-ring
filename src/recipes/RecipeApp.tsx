import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDownToLine, RotateCcw } from 'lucide-react'
import { confirmAction, showMessage } from '../AppDialog'
import { supabase } from '../auth'
import { contentMarkdown, emptyContent, emptyRecipes, parseMarkdown, parseRecipeData, recipeView, template, type Recipe, type RecipeData, type ShoppingItem, type Side } from './model'
import { OnlineRecipeStore, type SaveStatus } from './online'
import { CookingPhase, CookingPicker, ShoppingList } from './RecipePhases'
import { RecipeDetail } from './RecipeDetail'
import { RecipeEditor } from './RecipeEditor'
import { RecipeRecovery } from './RecipeRecovery'
import { ShoppingItemEditor, ShoppingRecipePicker } from './ShoppingDialogs'
import { GuidedEditor, type GuidedDraft } from './GuidedEditor'
import { MealPlan } from './MealPlan'
import { importRecipe } from './importRecipe'
import './recipes.css'

type Props = { identity: { id: string; demo: boolean }; view: string; exportWorkout: () => void; exportHabits: () => void }
export type RecipeHandle = { canLeave: () => boolean; leave: (done: () => void) => void; exportData: () => void; snapshot: () => RecipeData | null; replace: (data: RecipeData) => void }
const example = `# 🍲 Tofu rice bowl\n\nPortions: 4\nMacros per portion: Example values only\n\n## Quick glance\n- Prepare tofu and vegetables.\n- Cook the rice and vegetables.\n- Divide into four portions.\n\n## Ingredients\n- 400 g tofu\n- 200 g rice\n- 300 g vegetables\n\n## Pantry\n- 10 g oil\n\n## Instructions\n1. Prepare the vegetables and tofu.\n2. Cook the rice and vegetables.\n3. Divide into four portions.\n\n## Notes\nFictional demo recipe.`
function download(data: RecipeData) {
  const blob = new Blob([JSON.stringify({ scope: 'recipes', format: 1, data }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `one-ring-recipes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; a.click(); URL.revokeObjectURL(url)
}
function downloadDrafts(drafts: { recipeMarkdown?: string; guidedRecipe?: unknown; side?: Side; shoppingItem?: string; editedShoppingItem?: string }) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ scope: 'recipe-text-drafts', format: 1, ...drafts }, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = `one-ring-recipe-drafts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; a.click(); URL.revokeObjectURL(url)
}

export const RecipeApp = forwardRef<RecipeHandle, Props>(function RecipeApp({ identity, view, exportWorkout, exportHabits }, ref) {
  const [data, setData] = useState<RecipeData | null>(() => {
    if (!identity.demo) return null
    const id = crypto.randomUUID()
    return { ...emptyRecipes(), recipes: [{ id, markdown: example }], meta: { [id]: { idea: false, archived: false, rotation: true } } }
  })
  const [store, setStore] = useState<OnlineRecipeStore | null>(null)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [loadError, setLoadError] = useState(false); const [attempt, setAttempt] = useState(0)
  const [tab, setTab] = useState<'plan' | 'recipes' | 'shopping' | 'cooking'>('recipes')
  const [libraryView, setLibraryView] = useState<'all' | 'rotation' | 'ideas' | 'archived'>('rotation')
  const [selected, setSelected] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ id: string | null; markdown: string; original: string } | null>(null)
  const [guided, setGuided] = useState<GuidedDraft | null>(null)
  const [planDirty, setPlanDirty] = useState(false)
  const [planDraft, setPlanDraft] = useState<Side | null>(null)
  const [review, setReview] = useState(false); const [search, setSearch] = useState('')
  const [shoppingSelection, setShoppingSelection] = useState<string[]>([])
  const [manualItem, setManualItem] = useState('')
  const [shoppingPicker, setShoppingPicker] = useState(false)
  const [itemEdit, setItemEdit] = useState<{ id: string; text: string; original: string } | null>(null)
  const dataRef = useRef(data); dataRef.current = data
  const recipeTrigger = useRef<HTMLButtonElement | null>(null)
  const editorTrigger = useRef<HTMLButtonElement | null>(null)
  const dirty = !!editor && editor.markdown !== editor.original
  const guidedDirty = !!guided && JSON.stringify({ content: guided.content, source: guided.source, importText: guided.importText, importWarnings: guided.importWarnings }) !== guided.initial
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
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty || guidedDirty || planDirty || itemDirty || hasPendingItem || status !== 'saved') event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty, guidedDirty, planDirty, itemDirty, hasPendingItem, status])
  const closeEditor = async (restoreFocus = false) => { if (dirty && !await confirmAction('Discard unsaved recipe edits?', 'Discard changes')) return false; setEditor(null); setReview(false); if (restoreFocus && !selected) requestAnimationFrame(() => editorTrigger.current?.focus()); return true }
  const closeItemEditor = async () => { if (itemDirty && !await confirmAction('Discard unsaved shopping item changes?', 'Discard changes')) return false; setItemEdit(null); return true }
  const closeGuided = async () => { if (guidedDirty && !await confirmAction('Discard unsaved recipe changes?', 'Discard changes')) return false; setGuided(null); if (!selected) requestAnimationFrame(() => editorTrigger.current?.focus()); return true }
  useImperativeHandle(ref, () => ({ canLeave: () => !dirty && !guidedDirty && !planDirty && !itemDirty && !hasPendingItem && status === 'saved', leave: async done => { if (!planDirty && await closeEditor() && await closeGuided() && await closeItemEditor()) done() }, exportData: () => { if (dataRef.current) download(dataRef.current) }, snapshot: () => dataRef.current, replace: next => update(next) }))
  const update = (next: RecipeData) => { const validated = parseRecipeData(JSON.stringify(next)); dataRef.current = validated; setData(validated); store?.update(validated) }
  const switchTab = async (next: typeof tab) => { if (editor && !await closeEditor()) return; if (guided && !await closeGuided()) return; if (planDirty) return; setSelected(null); setTab(next) }
  const openGuided = (recipe?: Recipe) => {
    const content = recipe?.content ? structuredClone(recipe.content) : emptyContent()
    const source = recipe?.source || ''
    const importText = ''
    setGuided({ id: recipe?.id || null, content, source, importText, initial: JSON.stringify({ content, source, importText, importWarnings: recipe?.importWarnings }), importWarnings: recipe?.importWarnings })
  }
  const convertGuided = async (recipe: Recipe) => {
    if (!await confirmAction('Create a guided draft from this Markdown? Review the extracted fields before saving. The original Markdown will be retained.', 'Create guided draft')) return
    const imported = importRecipe(recipe.markdown)
    const initial = JSON.stringify({ content: emptyContent(), source: '', importText: '' })
    setGuided({ id: recipe.id, content: imported.content, source: recipe.source || recipe.markdown, importText: '', initial, importWarnings: imported.warnings })
  }
  const saveGuided = (asIdea = false) => {
    if (!guided || !guided.content.title.trim()) return
    const content = { ...guided.content, title: guided.content.title.trim(), fresh: guided.content.fresh.filter(s => s.trim()), pantry: guided.content.pantry.filter(s => s.trim()), steps: guided.content.steps.filter(s => s.trim()) }
    const recipe: Recipe = { id: guided.id || crypto.randomUUID(), content, markdown: contentMarkdown(content), ...(guided.source ? { source: guided.source } : {}), ...(guided.importWarnings?.length ? { importWarnings: guided.importWarnings } : {}) }
    const current = dataRef.current
    if (!current) return
    const meta = current.meta[recipe.id] || { archived: false, rotation: false }
    update({ ...current, recipes: guided.id ? current.recipes.map(r => r.id === guided.id ? recipe : r) : [...current.recipes, recipe], meta: { ...current.meta, [recipe.id]: { ...meta, idea: asIdea, rotation: asIdea ? false : meta.rotation } } })
    setLibraryView(asIdea ? 'ideas' : 'all')
    setGuided(null); setSelected(recipe.id)
  }
  const saveRecipe = () => {
    if (!editor || !data) return
    const parsed = parseMarkdown(editor.markdown)
    if (!parsed.title) { void showMessage('Add a title using # Recipe name before saving.'); return }
    const recipe = { id: editor.id || crypto.randomUUID(), markdown: editor.markdown }
    update({ ...data, recipes: editor.id ? data.recipes.map(r => r.id === editor.id ? recipe : r) : [...data.recipes, recipe] })
    setEditor(null); setReview(false); setSelected(recipe.id); setLibraryView('all')
  }
  const beginCooking = async (recipe: Recipe, fromPlan = false, side?: Side) => {
    if (!dataRef.current) return
    if (dataRef.current.cooking && !await confirmAction('Replace the current cooking phase and discard its progress? The new phase starts at the first step.', 'Restart cooking')) return
    const current = dataRef.current
    if (!current || (!fromPlan && !current.recipes.some(item => item.id === recipe.id && JSON.stringify(item) === JSON.stringify(recipe)))) { void showMessage('The saved recipe changed. Open it again before starting cooking.'); return }
    update({ ...current, cooking: { recipe, step: 0, ...(side ? { side } : {}) } }); setTab('cooking'); setSelected(null)
  }
  const addShoppingRecipes = async (ids: string[]) => {
    const initial = dataRef.current
    if (!initial || !ids.length) return
    const selectedRecipes = initial.recipes.filter(r => ids.includes(r.id) && !initial.shopping?.sources?.some(source => source.id === r.id))
    const needsReview = selectedRecipes.filter(recipe => { const parsed = recipeView(recipe); return !parsed.ingredients.length || parsed.warnings.some(w => /ingredient|pantry/i.test(w)) })
    if (needsReview.length && !await confirmAction(`Some ingredients may not be extracted for: ${needsReview.map(r => parseMarkdown(r.markdown).title).join(', ')}. Compare with the full recipes. Add only recognized items?`, 'Add recognized items')) return
    const current = dataRef.current
    if (!current) return
    const latest = selectedRecipes.filter(recipe => current.recipes.some(r => r.id === recipe.id && r.markdown === recipe.markdown) && !current.shopping?.sources?.some(source => source.id === recipe.id))
    if (latest.length !== selectedRecipes.length) { void showMessage('A selected recipe or shopping list changed. Review your selection and try again.'); return }
    const items = latest.flatMap(r => { const parsed = recipeView(r); return parsed.ingredients.map(i => ({ ...i, id: crypto.randomUUID(), recipe: parsed.title, state: 'needed' as const })) })
    if (!items.length) { void showMessage('No ingredient bullets were recognized. Edit the recipes and review the Ingredients and Pantry sections first.'); return }
    const sources = current.shopping ? current.shopping.sources && [...current.shopping.sources, ...latest] : latest
    update({ ...current, shopping: { ...current.shopping, items: [...(current.shopping?.items || []), ...items], ...(sources ? { sources } : {}) } }); setShoppingSelection([]); setShoppingPicker(false)
  }
  const shopPlan = async () => {
    const initial = dataRef.current
    if (!initial?.plan.length) return
    const meals = initial.plan.filter(meal => !initial.shopping?.planned?.includes(meal.id))
    if (!meals.length) { setTab('shopping'); void showMessage('These planned meals are already on the shopping list. Existing items keep their original copies; correct them in Shopping if needed.'); return }
    const problems = meals.some(meal => { const parsed = recipeView(meal.recipe); return !parsed.ingredients.length || parsed.warnings.some(w => /ingredient|pantry/i.test(w)) || (meal.side && !meal.side.shopping.trim()) })
    const message = `${initial.shopping ? 'Add the plan to the existing shopping list? Current items and statuses will remain. ' : 'Create a shopping list from the plan? '}${problems ? 'Some ingredients or side shopping quantities are missing or may not have been extracted. Review the recipes and add anything missing manually.' : 'Side shopping quantities are used exactly as written and are not multiplied by portions.'}`
    if (!await confirmAction(message, initial.shopping ? 'Add plan items' : 'Create shopping list')) return
    const current = dataRef.current
    if (!current || JSON.stringify(current.plan) !== JSON.stringify(initial.plan) || JSON.stringify(current.shopping) !== JSON.stringify(initial.shopping)) { void showMessage('The plan or shopping list changed. Review it and try again.'); return }
    const items = meals.flatMap(meal => {
      const parsed = recipeView(meal.recipe)
      return [...parsed.ingredients.map(i => ({ ...i, id: crypto.randomUUID(), recipe: parsed.title, state: 'needed' as const })), ...(meal.side?.shopping.trim() ? [{ id: crypto.randomUUID(), recipe: `${parsed.title} · ${meal.side.name}`, text: meal.side.shopping, pantry: false, state: 'needed' as const }] : [])]
    })
    if (!items.length) { void showMessage('No shopping items were found. Add ingredients or side shopping text first.'); return }
    const sources = current.shopping && !current.shopping.sources ? undefined : [...(current.shopping?.sources || [])]
    if (sources) for (const meal of meals) if (!sources.some(r => r.id === meal.recipe.id)) sources.push(meal.recipe)
    update({ ...current, shopping: { items: [...(current.shopping?.items || []), ...items], planned: [...(current.shopping?.planned || []), ...meals.map(meal => meal.id)], ...(sources ? { sources } : {}) } })
    setTab('shopping')
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
  const metadata = (id: string) => data?.meta[id] || { idea: false, archived: false, rotation: false }
  const visibleRecipes = data?.recipes.filter(r => {
    const meta = metadata(r.id)
    return r.markdown.toLowerCase().includes(search.toLowerCase()) && (libraryView === 'archived' ? meta.archived : !meta.archived && (libraryView === 'ideas' ? meta.idea : libraryView === 'rotation' ? meta.rotation && !meta.idea : !meta.idea))
  }) || []
  const changeMeta = async (id: string, next: ReturnType<typeof metadata>) => {
    if (next.archived && !metadata(id).archived && !await confirmAction('Archive this recipe? It will leave your current rotation but remain available in Archived.', 'Archive recipe')) return
    const current = dataRef.current
    if (current) update({ ...current, meta: { ...current.meta, [id]: next } })
  }
  const cookingSource = data?.cooking && data.recipes.find(recipe => recipe.id === data.cooking?.recipe.id)
  const cookingNotice = !data?.cooking ? '' : !cookingSource ? 'The saved recipe was deleted. This cooking phase keeps the original copy.' : JSON.stringify(cookingSource) !== JSON.stringify(data.cooking.recipe) ? 'The saved recipe changed. This cooking phase still uses the original copy.' : ''
  const shoppingNotice = !data?.shopping ? '' : !data.shopping.sources ? 'This older shopping list does not contain source snapshots; check the saved recipes for changes.' : data.shopping.sources.some(source => { const current = data.recipes.find(recipe => recipe.id === source.id); return !current || JSON.stringify(current) !== JSON.stringify(source) }) ? 'A saved recipe changed or was deleted. This list keeps its original items and states; review the saved recipe before shopping.' : ''
  const closeRecipe = () => { setSelected(null); requestAnimationFrame(() => recipeTrigger.current?.focus()) }
  return <>
    {status === 'saving' && <div role="status" className="habit-saving">Saving recipes…</div>}
    <div hidden={view !== 'recipes'} className="recipe-app">
      <header className="recipe-heading"><span>THE KITCHEN BOOK</span><h1>Recipe Book<span>✳</span></h1><p>Plan your shop. Cook at your pace.</p></header>
      {identity.demo && <p className="recipe-notice">Demo · Fictional example. Changes reset on refresh.</p>}
      {!data ? <div className="recipe-panel">{loadError ? <><h2>Recipes unavailable</h2><p>Could not load your recipes. Check your connection and retry. If this continues, the account service may need attention.</p><button onClick={() => setAttempt(n => n + 1)}>Retry</button></> : <p>Loading recipes…</p>}</div> : <>
        <nav className="recipe-tabs" aria-label="Recipe Book"><button aria-current={tab === 'plan' ? 'page' : undefined} onClick={() => void switchTab('plan')}>Plan</button><button aria-current={tab === 'recipes' ? 'page' : undefined} onClick={() => void switchTab('recipes')}>Recipes</button><button aria-current={tab === 'shopping' ? 'page' : undefined} onClick={() => void switchTab('shopping')}>Shopping{data.shopping ? ' •' : ''}</button><button aria-current={tab === 'cooking' ? 'page' : undefined} onClick={() => void switchTab('cooking')}>Cooking{data.cooking ? ' •' : ''}</button></nav>
          {tab === 'plan' && <MealPlan data={data} update={update} startCooking={(recipe, side) => void beginCooking(recipe, true, side)} shop={() => void shopPlan()} draftDirty={setPlanDirty} draftData={setPlanDraft}/>}
          {tab === 'recipes' && <>
            <div className="recipe-library-views" role="group" aria-label="Recipe library views">{(['all', 'rotation', 'ideas', 'archived'] as const).map(view => <button key={view} aria-pressed={libraryView === view} onClick={() => setLibraryView(view)}>{view === 'all' ? 'All recipes' : view === 'rotation' ? 'Rotation' : view === 'ideas' ? 'Ideas' : 'Archived'}</button>)}</div>
            <div className="recipe-toolbar"><label>Search recipes<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or ingredient"/></label><button onClick={event => { editorTrigger.current = event.currentTarget; setEditor({ id: null, markdown: template, original: template }) }}>Paste Markdown</button><button className="recipe-primary" onClick={event => { editorTrigger.current = event.currentTarget; openGuided() }}>+ Add recipe</button></div>
            <div className="recipe-list">{visibleRecipes.map(r => {
              const p = recipeView(r)
              return <button className="recipe-card" key={r.id} onClick={event => { recipeTrigger.current = event.currentTarget; setSelected(r.id) }}><span className="recipe-card-icon">✳</span><span><strong>{p.title}</strong><small>{p.portions ? `Yield: ${p.portions}` : 'Portions not specified'}</small><small>{p.macros || 'No macro summary'}</small></span><span aria-hidden="true">→</span></button>
            })}{!visibleRecipes.length && <p>{search ? 'No recipes match your search in this view.' : libraryView === 'rotation' ? 'Your rotation is empty. Open All recipes to choose regular recipes.' : libraryView === 'ideas' ? 'Save an unfinished recipe as an idea to keep it here.' : libraryView === 'archived' ? 'No archived recipes.' : 'Your recipe book is empty. Add your first recipe to get started.'}</p>}</div>
            {active && !editor && !guided && <RecipeDetail recipe={active} guidedEdit={() => void convertGuided(active)} addToPlan={() => { update({ ...data, plan: [...data.plan, { id: crypto.randomUUID(), recipe: active }] }); setSelected(null); setTab('plan') }} meta={metadata(active.id)} changeMeta={meta => void changeMeta(active.id, meta)} close={closeRecipe} edit={() => active.content ? openGuided(active) : setEditor({ id: active.id, markdown: active.markdown, original: active.markdown })} start={() => void beginCooking(active)} remove={() => { void (async () => { if (await confirmAction('Delete this recipe? Plan, shopping and cooking copies will remain.', 'Delete recipe')) { update({ ...data, recipes: data.recipes.filter(r => r.id !== active.id) }); setSelected(null) } })() }}/>}
          </>}
          {tab === 'shopping' && (data.shopping ? <ShoppingList items={data.shopping.items} changeItem={changeItem} manualItem={manualItem} setManualItem={setManualItem} sourceNotice={shoppingNotice} addRecipes={() => setShoppingPicker(true)} editItem={item => setItemEdit({ id: item.id, text: item.text, original: item.text })} removeItem={item => { void (async () => { if (!await confirmAction(`Remove ${item.text} from this shopping list? The saved recipe will not change.`, 'Remove item')) return; const current = dataRef.current; if (current?.shopping) update({ ...current, shopping: { ...current.shopping, items: current.shopping.items.filter(i => i.id !== item.id) } }) })() }} addItem={() => { if (!manualItem.trim() || !data.shopping) return; update({ ...data, shopping: { ...data.shopping, items: [...data.shopping.items, { id: crypto.randomUUID(), text: manualItem.trim(), recipe: 'Added item', pantry: false, state: 'needed' }] } }); setManualItem('') }} end={() => { void (async () => { const current = dataRef.current; if (!current?.shopping) return; const remaining = current.shopping.items.filter(item => item.state === 'needed').length; const draftNotice = manualItem.trim() ? ' The unadded item text will also be discarded.' : ''; if (await confirmAction(`End shopping and clear this checklist? ${remaining} items are still marked Need.${draftNotice}`, 'End shopping')) { const latest = dataRef.current; if (latest?.shopping) update({ ...latest, shopping: null }); setManualItem('') } })() }}/> : <section className="recipe-panel"><span className="recipe-kicker">SHOPPING</span><h2>Choose recipes</h2><p>Select recipes to build a checklist. Nothing changes in your saved recipes. Compare the extracted items with the full recipes.</p>{data.recipes.filter(r => !metadata(r.id).archived && !metadata(r.id).idea).map(r => <label className="recipe-select" key={r.id}><input type="checkbox" checked={shoppingSelection.includes(r.id)} onChange={e => setShoppingSelection(e.target.checked ? [...shoppingSelection, r.id] : shoppingSelection.filter(id => id !== r.id))}/>{parseMarkdown(r.markdown).title}</label>)}{!data.recipes.length && <p>Add a recipe first.</p>}<button className="recipe-primary" disabled={!shoppingSelection.length} onClick={() => void addShoppingRecipes(shoppingSelection)}>Start shopping</button></section>)}
          {tab === 'cooking' && (data.cooking ? <CookingPhase side={data.cooking.side} cancel={() => { void (async () => { if (await confirmAction('Cancel cooking and discard this progress without recording a preparation?', 'Cancel cooking')) { const current = dataRef.current; if (current) update({ ...current, cooking: null }) } })() }} recipe={data.cooking.recipe} step={data.cooking.step} sourceNotice={cookingNotice} restart={cookingNotice && cookingSource ? () => void beginCooking(cookingSource, false, data.cooking?.side) : undefined} move={step => { if (data.cooking) update({ ...data, cooking: { ...data.cooking, step } }) }} finish={() => { void (async () => { if (await confirmAction('Finish this cooking phase and record this recipe as prepared today? The saved recipe will not change.', 'Finish and record')) { const current = dataRef.current; if (current?.cooking) { const id = current.cooking.recipe.id; const d = new Date(); const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; update({ ...current, cooking: null, meta: { ...current.meta, [id]: { ...(current.meta[id] || { idea: false, archived: false, rotation: false }), lastPrepared: date } } }) } } })() }}/> : <CookingPicker recipes={data.recipes.filter(recipe => !metadata(recipe.id).archived && !metadata(recipe.id).idea)} start={recipe => void beginCooking(recipe)}/>)}
          {shoppingPicker && data.shopping && <ShoppingRecipePicker recipes={data.recipes.filter(r => !metadata(r.id).archived && !metadata(r.id).idea)} current={data.shopping.sources?.map(source => source.id) || []} close={() => setShoppingPicker(false)} add={ids => void addShoppingRecipes(ids)}/>}
          {itemEdit && <ShoppingItemEditor text={itemEdit.text} change={text => setItemEdit({ ...itemEdit, text })} save={() => { const current = dataRef.current; if (!current?.shopping || !itemEdit.text.trim()) return; update({ ...current, shopping: { ...current.shopping, items: current.shopping.items.map(item => item.id === itemEdit.id ? { ...item, text: itemEdit.text.trim() } : item) } }); setItemEdit(null) }} close={() => void closeItemEditor()}/>}
          {guided && <GuidedEditor draft={guided} change={setGuided} close={() => void closeGuided()} save={saveGuided}/>}
          {editor && <RecipeEditor editor={editor} review={review} change={markdown => setEditor({ ...editor, markdown })} setReview={setReview} close={() => void closeEditor(true)} save={saveRecipe}/>}
      </>}
    </div>
    <div hidden={view !== 'settings'}>{data && <div className="settings-card backup-card"><h3>Recipe backup</h3><p>Recipes, rotation, side presets, meal-prep plan and active phases. Unsaved editor text is excluded.</p><div className="settings-actions"><button className="outline-button" onClick={() => download(data)}><ArrowDownToLine size={16} aria-hidden="true"/> Export recipes</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore recipes<input type="file" accept="application/json,.json" onChange={e => { void restore(e.target.files?.[0]); e.target.value = '' }}/></label></div></div>}</div>
    {(status === 'error' || status === 'conflict') && <RecipeRecovery status={status} retry={() => store?.retry()} exportRecipes={() => { if (dataRef.current) download(dataRef.current) }} exportDrafts={dirty || guidedDirty || planDirty || itemDirty || hasPendingItem ? () => downloadDrafts({ ...(dirty ? { recipeMarkdown: editor!.markdown } : {}), ...(guidedDirty ? { guidedRecipe: guided } : {}), ...(planDraft ? { side: planDraft } : {}), ...(hasPendingItem ? { shoppingItem: manualItem } : {}), ...(itemDirty ? { editedShoppingItem: itemEdit!.text } : {}) }) : undefined} exportWorkout={exportWorkout} exportHabits={exportHabits}/>}
  </>
})
