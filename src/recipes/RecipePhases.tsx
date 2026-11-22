import { useState } from 'react'
import { Check, ShoppingBag, House, RotateCcw } from 'lucide-react'
import { parseMarkdown, type Recipe, type ShoppingItem } from './model'

type ShoppingProps = {
  items: ShoppingItem[]
  changeItem: (id: string, state: ShoppingItem['state']) => void
  manualItem: string
  setManualItem: (value: string) => void
  addItem: () => void
  end: () => void
}

const states = [
  { value: 'needed', label: 'Need', Icon: RotateCcw },
  { value: 'have', label: 'Have', Icon: House },
  { value: 'bought', label: 'Bought', Icon: ShoppingBag },
] as const

export function ShoppingList({ items, changeItem, manualItem, setManualItem, addItem, end }: ShoppingProps) {
  const counts = { needed: items.filter(item => item.state === 'needed').length, have: items.filter(item => item.state === 'have').length, bought: items.filter(item => item.state === 'bought').length }
  return <section className="recipe-panel shopping-screen">
    <div className="shopping-heading"><div><span className="recipe-kicker">SHOPPING</span><h2>Your list</h2></div><button onClick={end}>End shopping</button></div>
    <p>Check what you have, then mark items bought at the store.</p>
    <div className="shopping-summary" aria-label="Shopping list summary"><span className="summary-needed">{counts.needed} need</span><span className="summary-have">{counts.have} have</span><span className="summary-bought">{counts.bought} bought</span></div>
    <div className="shopping-items">{items.map(item => <article key={item.id} className={`recipe-item shopping-item is-${item.state}`}>
      <div className="shopping-item-heading"><div><strong>{item.text}</strong><small>{item.recipe}{item.pantry ? ' · Pantry check' : ''}</small></div><span className="shopping-state">{item.state === 'needed' ? 'Need' : item.state === 'have' ? 'Have' : 'Bought'}</span></div>
      <div className="shopping-choices" role="group" aria-label={`Shopping status for ${item.text}, ${item.recipe}`}>
        {states.map(({ value, label, Icon }) => <button key={value} type="button" className={`shopping-choice choice-${value}`} aria-pressed={item.state === value} onClick={() => changeItem(item.id, value)}><Icon size={16} aria-hidden="true"/>{label}{item.state === value && <Check size={14} aria-hidden="true"/>}</button>)}
      </div>
    </article>)}</div>
    <div className="shopping-add"><label>Add an item<input value={manualItem} onChange={event => setManualItem(event.target.value)} placeholder="e.g. pantry restock"/></label><button disabled={!manualItem.trim()} onClick={addItem}>Add item</button></div>
  </section>
}

export function CookingPicker({ recipes, start }: { recipes: Recipe[]; start: (recipe: Recipe) => void }) {
  return <section className="recipe-panel cooking-picker"><span className="recipe-kicker">COOKING</span><h2>Choose a recipe</h2><p>Start here, or come back to an in-progress recipe at any time.</p>
    {recipes.length ? <div className="cooking-choices">{recipes.map(recipe => { const parsed = parseMarkdown(recipe.markdown); return <article key={recipe.id} className="cooking-choice"><div><h3>{parsed.title}</h3><p>{parsed.portions ? `${parsed.portions} portions` : 'Portions not specified'}</p></div><button className="recipe-primary" onClick={() => start(recipe)} aria-label={`Start cooking ${parsed.title}`}>Start cooking</button></article> })}</div> : <p>Add a recipe in Recipes before starting to cook.</p>}
  </section>
}

export function CookingPhase({ recipe, step, move, finish }: { recipe: Recipe; step: number; move: (step: number) => void; finish: () => void }) {
  const [fullRecipe, setFullRecipe] = useState(false)
  const parsed = parseMarkdown(recipe.markdown)
  if (fullRecipe) return <section className="recipe-panel cooking-full-recipe"><div className="shopping-heading"><div><span className="recipe-kicker">COOKING</span><h2>{parsed.title}</h2></div><button aria-label="Close full recipe" onClick={() => setFullRecipe(false)}>×</button></div><button onClick={() => setFullRecipe(false)}>← Back to cooking</button><pre className="recipe-document">{recipe.markdown}</pre></section>
  return <section className="recipe-panel cooking-screen"><span className="recipe-kicker">COOKING · RECIPE SNAPSHOT</span><h2>{parsed.title}</h2><p className="recipe-macros">{parsed.portions && `Portions: ${parsed.portions} · `}{parsed.macros || 'Macros not specified'}</p>
    {parsed.steps.length ? <><div className="recipe-step"><small>STEP {step + 1} OF {parsed.steps.length}</small><p>{parsed.steps[step]}</p></div><div className="cooking-controls"><button disabled={step === 0} onClick={() => move(step - 1)}>← Previous</button><button className="recipe-primary" disabled={step >= parsed.steps.length - 1} onClick={() => move(step + 1)}>Next →</button></div></> : <p>Steps were not recognized; use the full recipe.</p>}
    <div className="cooking-ingredients"><h3>Ingredients</h3><ul>{parsed.ingredients.map((item, index) => <li key={index}>{item.text}</li>)}</ul></div>
    <div className="recipe-actions"><button onClick={() => setFullRecipe(true)}>View full recipe</button><button onClick={finish}>Finish cooking</button></div>
  </section>
}
