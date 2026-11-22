import { useEffect, useRef, useState } from 'react'
import { parseMarkdown, type Recipe } from './model'

function ShoppingWindow({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { const element = dialog.current; if (!element) return; element.showModal(); heading.current?.focus(); return () => { if (element.open) element.close() } }, [])
  return <dialog ref={dialog} className="recipe-detail-dialog shopping-dialog" aria-labelledby="shopping-window-title" onCancel={event => { event.preventDefault(); close() }}>
    <div className="recipe-detail-shell"><header className="recipe-detail-top"><span>SHOPPING</span><button type="button" className="recipe-detail-close" aria-label="Close shopping window" onClick={close}>×</button></header>
      <div className="recipe-detail-body"><section className="recipe-panel"><h2 ref={heading} id="shopping-window-title" tabIndex={-1}>{title}</h2>{children}</section></div>
    </div>
  </dialog>
}

export function ShoppingRecipePicker({ recipes, current, close, add }: { recipes: Recipe[]; current: string[]; close: () => void; add: (ids: string[]) => void }) {
  const [chosen, setChosen] = useState<string[]>([])
  return <ShoppingWindow title="Add recipes to shopping" close={close}><p>New recipe items are added to the current checklist. Existing items and their states remain unchanged.</p>{recipes.map(recipe => <label className="recipe-select" key={recipe.id}><input type="checkbox" disabled={current.includes(recipe.id)} checked={current.includes(recipe.id) || chosen.includes(recipe.id)} onChange={event => setChosen(event.target.checked ? [...chosen, recipe.id] : chosen.filter(id => id !== recipe.id))}/><span>{parseMarkdown(recipe.markdown).title}{current.includes(recipe.id) ? ' · Already added' : ''}</span></label>)}<div className="recipe-actions"><button className="recipe-primary" disabled={!chosen.length} onClick={() => add(chosen)}>Add selected recipes</button><button onClick={close}>Cancel</button></div></ShoppingWindow>
}

export function ShoppingItemEditor({ text, change, save, close }: { text: string; change: (text: string) => void; save: () => void; close: () => void }) {
  return <ShoppingWindow title="Edit shopping item" close={close}><p>Changes apply only to this shopping list, not the saved recipe.</p><label>Shopping item<input value={text} onChange={event => change(event.target.value)}/></label><div className="recipe-actions"><button className="recipe-primary" disabled={!text.trim()} onClick={save}>Save item</button><button onClick={close}>Cancel</button></div></ShoppingWindow>
}
