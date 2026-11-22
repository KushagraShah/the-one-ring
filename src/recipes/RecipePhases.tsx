import { useRef, useState } from 'react'
import { Check, ShoppingBag, House, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { parseMarkdown, type Recipe, type ShoppingItem } from './model'
import { RecipeMarkdown } from './RecipeMarkdown'
import { CookingRecipeWindow } from './CookingRecipeWindow'

type ShoppingProps = {
  items: ShoppingItem[]
  changeItem: (id: string, state: ShoppingItem['state']) => void
  manualItem: string
  setManualItem: (value: string) => void
  addItem: () => void
  editItem: (item: ShoppingItem) => void
  removeItem: (item: ShoppingItem) => void
  addRecipes: () => void
  sourceNotice: string
  end: () => void
}

export function ShoppingList({ items, changeItem, manualItem, setManualItem, addItem, editItem, removeItem, addRecipes, sourceNotice, end }: ShoppingProps) {
  const counts = { needed: items.filter(item => item.state === 'needed').length, have: items.filter(item => item.state === 'have').length, bought: items.filter(item => item.state === 'bought').length }
  return <section className="recipe-panel shopping-screen">
    <div className="shopping-heading"><div><span className="recipe-kicker">SHOPPING</span><h2>Your list</h2></div><button onClick={end}>End shopping</button></div>
    <p>Check what you have, then mark items bought at the store.</p>
    {sourceNotice && <p className="recipe-warning" role="status">{sourceNotice}</p>}
    <button onClick={addRecipes}>Add recipes</button>
    <div className="shopping-summary" aria-label="Shopping list summary"><span className="summary-needed">{counts.needed} need</span><span className="summary-have">{counts.have} have</span><span className="summary-bought">{counts.bought} bought</span></div>
    <div className="shopping-items">{items.map(item => <article key={item.id} className={`recipe-item shopping-item is-${item.state}`}>
      <div className="shopping-item-heading"><div><strong>{item.text}</strong><small>{item.recipe}{item.pantry ? ' · Pantry check' : ''}</small></div><span className="shopping-state">{item.state === 'needed' ? 'Need' : item.state === 'have' ? 'Have' : 'Bought'}</span></div>
      <div className="shopping-choices" role="group" aria-label={`Shopping status for ${item.text}, ${item.recipe}`}>
        <button type="button" className="shopping-choice choice-have" aria-pressed={item.state === 'have'} onClick={() => changeItem(item.id, item.state === 'have' ? 'needed' : 'have')}><House size={16} aria-hidden="true"/> Have{item.state === 'have' && <Check size={14} aria-hidden="true"/>}</button>
        <button type="button" className="shopping-choice choice-bought" aria-pressed={item.state === 'bought'} onClick={() => changeItem(item.id, item.state === 'bought' ? 'needed' : 'bought')}><ShoppingBag size={16} aria-hidden="true"/> Bought{item.state === 'bought' && <Check size={14} aria-hidden="true"/>}</button>
        <button type="button" className="shopping-reset" aria-label={`Mark ${item.text} from ${item.recipe} as needed`} disabled={item.state === 'needed'} onClick={() => changeItem(item.id, 'needed')}><RotateCcw size={17} aria-hidden="true"/></button>
      </div>
      <div className="shopping-item-tools"><button type="button" onClick={() => editItem(item)} aria-label={`Edit ${item.text} from ${item.recipe}`}><Pencil size={15} aria-hidden="true"/> Edit</button><button type="button" onClick={() => removeItem(item)} aria-label={`Remove ${item.text} from ${item.recipe}`}><Trash2 size={15} aria-hidden="true"/> Remove</button></div>
    </article>)}</div>
    <div className="shopping-add"><label>Add an item<input value={manualItem} onChange={event => setManualItem(event.target.value)} placeholder="e.g. pantry restock"/></label><button disabled={!manualItem.trim()} onClick={addItem}>Add item</button></div>
  </section>
}

export function CookingPicker({ recipes, start }: { recipes: Recipe[]; start: (recipe: Recipe) => void }) {
  return <section className="recipe-panel cooking-picker"><span className="recipe-kicker">COOKING</span><h2>Choose a recipe</h2><p>Start here, or come back to an in-progress recipe at any time.</p>
    {recipes.length ? <div className="cooking-choices">{recipes.map(recipe => { const parsed = parseMarkdown(recipe.markdown); return <article key={recipe.id} className="cooking-choice"><div><h3>{parsed.title}</h3><p>{parsed.portions ? `${parsed.portions} portions` : 'Portions not specified'}</p></div><button className="recipe-primary" onClick={() => start(recipe)} aria-label={`Start cooking ${parsed.title}`}>Start cooking</button></article> })}</div> : <p>Add a recipe in Recipes before starting to cook.</p>}
  </section>
}

export function CookingPhase({ recipe, step, move, finish, sourceNotice, restart }: { recipe: Recipe; step: number; move: (step: number) => void; finish: () => void; sourceNotice: string; restart?: () => void }) {
  const [fullRecipe, setFullRecipe] = useState(false)
  const fullRecipeButton = useRef<HTMLButtonElement>(null)
  const parsed = parseMarkdown(recipe.markdown)
  const closeFullRecipe = () => { setFullRecipe(false); requestAnimationFrame(() => fullRecipeButton.current?.focus()) }
  return <section className="recipe-panel cooking-screen"><span className="recipe-kicker">COOKING · RECIPE SNAPSHOT</span><h2>{parsed.title}</h2><p className="recipe-macros">{parsed.portions && `Portions: ${parsed.portions} · `}{parsed.macros || 'Macros not specified'}</p>
    {sourceNotice && <div className="cooking-source-notice"><p className="recipe-warning" role="status">{sourceNotice}</p>{restart && <button onClick={restart}>Restart with saved recipe</button>}</div>}
    {parsed.warnings.some(warning => warning.toLowerCase().includes('instruction')) && <p className="recipe-warning">Some instructions may not appear as steps. Check the full recipe before cooking.</p>}
    {parsed.steps.length ? <><div className="recipe-step"><small>STEP {step + 1} OF {parsed.steps.length}</small><p>{parsed.steps[step]}</p></div><div className="cooking-controls"><button disabled={step === 0} onClick={() => move(step - 1)}>← Previous</button><button className="recipe-primary" disabled={step >= parsed.steps.length - 1} onClick={() => move(step + 1)}>Next →</button></div></> : <p>Steps were not recognized; use the full recipe.</p>}
    <div className="cooking-ingredients"><h3>Quick glance</h3>{parsed.quickGlance ? <RecipeMarkdown text={parsed.quickGlance}/> : <p>No quick glance was included in this recipe. Add a <code>## Quick glance</code> section when editing it.</p>}</div>
    <div className="recipe-actions"><button ref={fullRecipeButton} onClick={() => setFullRecipe(true)}>View full recipe</button><button onClick={finish}>Finish cooking</button></div>
    {fullRecipe && <CookingRecipeWindow title={parsed.title} markdown={recipe.markdown} close={closeFullRecipe}/>}
  </section>
}
