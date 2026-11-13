import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDownToLine, RotateCcw } from 'lucide-react'
import { confirmAction, showMessage } from '../AppDialog'
import { supabase } from '../auth'
import { emptyRecipes, parseMarkdown, parseRecipeData, template, type Recipe, type RecipeData, type ShoppingItem } from './model'
import { OnlineRecipeStore, type SaveStatus } from './online'
import './recipes.css'

type Props = { identity: { id: string; demo: boolean }; view: string; exportWorkout: () => void; exportHabits: () => void }
export type RecipeHandle = { canLeave: () => boolean; leave: (done: () => void) => void; exportData: () => void }
const example = `# 🍲 Tofu rice bowl\n\nPortions: 4\nMacros per portion: Example values only\n\n## Ingredients\n- 400 g tofu\n- 200 g rice\n- 300 g vegetables\n\n## Pantry\n- 10 g oil\n\n## Instructions\n1. Prepare the vegetables and tofu.\n2. Cook the rice and vegetables.\n3. Divide into four portions.\n\n## Notes\nFictional demo recipe.`
function download(data: RecipeData) {
  const blob = new Blob([JSON.stringify({ scope: 'recipes', format: 1, data }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `one-ring-recipes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; a.click(); URL.revokeObjectURL(url)
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
  const dataRef = useRef(data); dataRef.current = data
  const dirty = !!editor && editor.markdown !== editor.original
  useEffect(() => {
    if (identity.demo) return
    if (!supabase) { setLoadError(true); return }
    let active = true; const next = new OnlineRecipeStore(supabase, identity.id); setLoadError(false)
    next.load().then(result => { if (active) { setData(result); setStore(next) } }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [identity.id, identity.demo, attempt])
  useLayoutEffect(() => { if (!store) return; store.onStatus = setStatus; return () => { store.onStatus = () => {} } }, [store])
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty || status !== 'saved') event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty, status])
  const closeEditor = async () => { if (dirty && !await confirmAction('Discard unsaved recipe edits?')) return false; setEditor(null); setReview(false); return true }
  useImperativeHandle(ref, () => ({ canLeave: () => !dirty && status === 'saved', leave: async done => { if (await closeEditor()) done() }, exportData: () => { if (data) download(data) } }))
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
    if (!data) return
    if (data.cooking && !await confirmAction('Replace the current cooking phase? Its progress will be discarded.')) return
    update({ ...data, cooking: { recipe: { ...recipe }, step: 0 } }); setTab('cooking'); setSelected(null)
  }
  const beginShopping = async () => {
    if (!data || !shoppingSelection.length) return
    if (data.shopping && !await confirmAction('Replace the current shopping phase and its checklist?')) return
    const items = data.recipes.filter(r => shoppingSelection.includes(r.id)).flatMap(r => { const parsed = parseMarkdown(r.markdown); return parsed.ingredients.map(i => ({ ...i, id: crypto.randomUUID(), recipe: parsed.title, state: 'needed' as const })) })
    if (!items.length) { void showMessage('No ingredient bullets were recognized. Edit the recipes and review the Ingredients and Pantry sections first.'); return }
    update({ ...data, shopping: { items } }); setShoppingSelection([])
  }
  const changeItem = (id: string, state: ShoppingItem['state']) => { if (data?.shopping) update({ ...data, shopping: { items: data.shopping.items.map(item => item.id === id ? { ...item, state } : item) } }) }
  const restore = async (file?: File) => {
    if (!file || !data) return
    try {
      if (file.size > 10_000_000) throw Error('Too large')
      const value = JSON.parse(await file.text()); if (value.scope !== 'recipes' || value.format !== 1) throw Error('Wrong scope')
      const next = parseRecipeData(JSON.stringify(value.data))
      if (await confirmAction('Replace all recipe data and active recipe phases with this backup? Workouts and habits will not change.')) { update(next); setEditor(null); setSelected(null) }
    } catch { void showMessage('Invalid recipe backup. No recipe data was replaced.') }
  }
  const active = data?.recipes.find(r => r.id === selected)
  const parsed = editor ? parseMarkdown(editor.markdown) : null
  return <>
    {(status === 'error' || status === 'conflict') && <div role="alert" className="save-recovery-overlay"><div className="save-recovery-card"><h2>{status === 'conflict' ? 'Recipes changed elsewhere' : 'Could not save recipes'}</h2><p>Recipe changes are not confirmed. Keep this page open and export them before reloading. Reloading can discard unsaved changes in other apps too.</p>{status === 'error' && <button className="primary" onClick={() => store?.retry()}>Retry recipe save</button>} {data && <button className="outline-button" onClick={() => download(data)}>Export unsaved recipes</button>} <button className="outline-button" onClick={exportWorkout}>Export workouts</button> <button className="outline-button" onClick={exportHabits}>Export habits</button> <button className="outline-button" onClick={async () => { if (await confirmAction('Discard all unsaved changes across apps and reload? Export them first.')) window.location.reload() }}>Discard and reload</button></div></div>}
    {status === 'saving' && <div role="status" className="habit-saving">Saving recipes…</div>}
    <div hidden={view !== 'recipes'} className="recipe-app">
      <header className="recipe-heading"><span>THE KITCHEN BOOK</span><h1>Recipe Book<span>✳</span></h1><p>Plan your shop. Cook at your pace.</p></header>
      {identity.demo && <p className="recipe-notice">Demo · Fictional example. Changes reset on refresh.</p>}
      {!data ? <div className="recipe-panel">{loadError ? <><h2>Recipes unavailable</h2><p>Check your connection. Signed-in recipes also require the new recipe database migration; it has not been applied by this preview.</p><button onClick={() => setAttempt(n => n + 1)}>Retry</button></> : <p>Loading recipes…</p>}</div> : <>
        <nav className="recipe-tabs" aria-label="Recipe Book"><button aria-current={tab === 'recipes' ? 'page' : undefined} onClick={() => void switchTab('recipes')}>Recipes</button><button aria-current={tab === 'shopping' ? 'page' : undefined} onClick={() => void switchTab('shopping')}>Shopping{data.shopping ? ' •' : ''}</button><button aria-current={tab === 'cooking' ? 'page' : undefined} onClick={() => void switchTab('cooking')}>Cooking{data.cooking ? ' •' : ''}</button></nav>
        {editor ? <section className="recipe-panel recipe-editor"><div className="recipe-row"><h2>{editor.id ? 'Edit recipe' : 'Add recipe'}</h2><button aria-label="Close editor" onClick={() => void closeEditor()}>×</button></div><p>Paste Markdown using the template. The original text is preserved.</p><label>Recipe Markdown<textarea value={editor.markdown} onChange={event => { setEditor({ ...editor, markdown: event.target.value }); setReview(false) }} rows={16}/></label><div className="recipe-actions"><button onClick={() => setReview(true)}>Review recipe</button><button onClick={() => void closeEditor()}>Cancel</button></div>{review && parsed && <div className="recipe-review"><h3>Import review</h3><p><strong>Title:</strong> {parsed.title || 'Missing — add a # heading'}</p><p><strong>Portions:</strong> {parsed.portions || 'Not recognized'}</p><p><strong>Macros per portion:</strong> {parsed.macros || 'Not recognized'}</p><p>{parsed.ingredients.length} ingredient lines · {parsed.steps.length} instruction steps recognized.</p><ul>{parsed.ingredients.map((i, n) => <li key={n}>{i.pantry ? 'Pantry · ' : ''}{i.text}</li>)}</ul>{(!parsed.ingredients.length || !parsed.steps.length) && <p>Some sections were not recognized. The full Markdown is still retained; check the template before shopping or cooking.</p>}<button className="recipe-primary" disabled={!parsed.title} onClick={saveRecipe}>Save recipe</button></div>}</section> : <>
          {tab === 'recipes' && (active ? <section className="recipe-panel"><div className="recipe-row"><button onClick={() => setSelected(null)}>← Recipes</button><button onClick={() => setEditor({ id: active.id, markdown: active.markdown, original: active.markdown })}>Edit recipe</button></div><h2>{parseMarkdown(active.markdown).title}</h2><p className="recipe-meta">{parseMarkdown(active.markdown).portions && `Portions: ${parseMarkdown(active.markdown).portions}`}</p><p className="recipe-macros">{parseMarkdown(active.markdown).macros || 'Macros per portion not specified'}</p><pre className="recipe-document">{active.markdown}</pre><div className="recipe-actions"><button className="recipe-primary" onClick={() => void beginCooking(active)}>Start cooking</button><button onClick={async () => { if (await confirmAction('Delete this recipe? Active shopping and cooking phases keep their snapshots.')) { update({ ...data, recipes: data.recipes.filter(r => r.id !== active.id) }); setSelected(null) } }}>Delete recipe</button></div></section> : <><div className="recipe-toolbar"><label>Search recipes<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or ingredient"/></label><button className="recipe-primary" onClick={() => setEditor({ id: null, markdown: template, original: template })}>+ Add recipe</button></div><div className="recipe-list">{data.recipes.filter(r => r.markdown.toLowerCase().includes(search.toLowerCase())).map(r => { const p = parseMarkdown(r.markdown); return <button className="recipe-card" key={r.id} onClick={() => setSelected(r.id)}><span className="recipe-card-icon">✳</span><span><strong>{p.title}</strong><small>{p.portions ? `${p.portions} portions` : 'Portions not specified'}</small><small>{p.macros || 'No macro summary'}</small></span><span aria-hidden="true">→</span></button> })}{!data.recipes.length && <p>Your recipe book is empty. Add your first recipe to get started.</p>}</div></>)}
          {tab === 'shopping' && <section className="recipe-panel"><h2>{data.shopping ? 'Shopping list' : 'Start shopping'}</h2>{data.shopping ? <><p>Each ingredient is kept separate by recipe. Mark what you have or buy.</p>{(['needed', 'have', 'bought'] as const).map(state => <div className="recipe-shopping-group" key={state}><h3>{state === 'needed' ? 'Need to check or buy' : state === 'have' ? 'Already have' : 'Bought'}</h3>{data.shopping!.items.filter(i => i.state === state).map(item => <div className="recipe-item" key={item.id}><div><strong>{item.text}</strong><small>{item.recipe}{item.pantry ? ' · Pantry check' : ''}</small></div><div className="recipe-actions">{state !== 'needed' && <button onClick={() => changeItem(item.id, 'needed')}>Need</button>}{state !== 'have' && <button onClick={() => changeItem(item.id, 'have')}>Have</button>}{state !== 'bought' && <button onClick={() => changeItem(item.id, 'bought')}>Bought</button>}</div></div>)}</div>)}<label>Add an item<input value={manualItem} onChange={e => setManualItem(e.target.value)} placeholder="e.g. pantry restock"/></label><div className="recipe-actions"><button disabled={!manualItem.trim()} onClick={() => { update({ ...data, shopping: { items: [...data.shopping!.items, { id: crypto.randomUUID(), text: manualItem.trim(), recipe: 'Added item', pantry: false, state: 'needed' }] } }); setManualItem('') }}>Add item</button><button onClick={async () => { if (await confirmAction('End shopping and clear this checklist?')) update({ ...data, shopping: null }) }}>End shopping</button></div></> : <><p>Select recipes to build a checklist. Nothing changes in your saved recipes.</p>{data.recipes.map(r => <label className="recipe-select" key={r.id}><input type="checkbox" checked={shoppingSelection.includes(r.id)} onChange={e => setShoppingSelection(e.target.checked ? [...shoppingSelection, r.id] : shoppingSelection.filter(id => id !== r.id))}/>{parseMarkdown(r.markdown).title}</label>)}{!data.recipes.length && <p>Add a recipe first.</p>}<button className="recipe-primary" disabled={!shoppingSelection.length} onClick={() => void beginShopping()}>Start shopping</button></>}</section>}
          {tab === 'cooking' && <section className="recipe-panel">{data.cooking ? (() => { const cooking = data.cooking!; const p = parseMarkdown(cooking.recipe.markdown); return <><span className="recipe-kicker">COOKING · RECIPE SNAPSHOT</span><h2>{p.title}</h2><p className="recipe-macros">{p.portions && `Portions: ${p.portions} · `}{p.macros || 'Macros not specified'}</p>{p.steps.length ? <><div className="recipe-step"><small>STEP {cooking.step + 1} OF {p.steps.length}</small><p>{p.steps[cooking.step]}</p></div><div className="recipe-actions"><button disabled={cooking.step === 0} onClick={() => update({ ...data, cooking: { ...cooking, step: cooking.step - 1 } })}>← Previous</button><button disabled={cooking.step >= p.steps.length - 1} onClick={() => update({ ...data, cooking: { ...cooking, step: cooking.step + 1 } })}>Next →</button></div></> : <p>Steps were not recognized; use the full recipe below.</p>}<h3>Ingredients</h3><ul>{p.ingredients.map((i, n) => <li key={n}>{i.text}</li>)}</ul><h3>Full recipe</h3><pre className="recipe-document">{cooking.recipe.markdown}</pre><button onClick={async () => { if (await confirmAction('End this cooking phase? The saved recipe will not change.')) update({ ...data, cooking: null }) }}>Finish cooking</button></> })() : <><h2>Ready to cook?</h2><p>Open a recipe and choose Start cooking. Your place will be saved when online.</p><button className="recipe-primary" onClick={() => setTab('recipes')}>Browse recipes</button></>}</section>}
        </>}
      </>}
    </div>
    <div hidden={view !== 'settings'}>{data && <div className="settings-card backup-card"><h3>Recipe backup</h3><p>Recipes and active phases only. The existing workout/habit backup does not include recipes in this preview.</p><div className="settings-actions"><button className="outline-button" onClick={() => download(data)}><ArrowDownToLine size={16} aria-hidden="true"/> Export recipes</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore recipes<input type="file" accept="application/json,.json" onChange={e => { void restore(e.target.files?.[0]); e.target.value = '' }}/></label></div></div>}</div>
  </>
})
