import { useEffect, useRef } from 'react'
import { parseMarkdown, type Recipe, type RecipeMeta } from './model'
import { RecipeMarkdown } from './RecipeMarkdown'

export function RecipeDetail({ recipe, close, edit, start, remove, meta, changeMeta }: { recipe: Recipe; close: () => void; edit: () => void; start: () => void; remove: () => void; meta: RecipeMeta; changeMeta: (meta: RecipeMeta) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const parsed = parseMarkdown(recipe.markdown)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    title.current?.focus()
    return () => { if (element.open) element.close() }
  }, [])
  return <dialog ref={dialog} className="recipe-detail-dialog" aria-labelledby="recipe-detail-title" onCancel={event => { event.preventDefault(); close() }}>
    <div className="recipe-detail-shell">
      <header className="recipe-detail-top"><span>RECIPE BOOK</span><button type="button" className="recipe-detail-close" aria-label="Close recipe" onClick={close}>×</button></header>
      <div className="recipe-detail-body">
        <div className="recipe-detail-title"><span className="recipe-kicker">YOUR RECIPE</span><h2 id="recipe-detail-title" ref={title} tabIndex={-1}>{parsed.title}</h2>{parsed.portions && <p>Portions: {parsed.portions}</p>}</div>
        <div className="recipe-detail-macros"><span>PER PORTION</span><p>{parsed.macros || 'Macros per portion not specified'}</p></div>
        <div className="recipe-detail-actions"><button className="recipe-detail-start" onClick={start}>Start cooking</button><button onClick={edit}>Edit recipe</button></div>
        <div className="recipe-detail-actions">
          <button onClick={() => changeMeta({ ...meta, idea: !meta.idea, rotation: meta.idea ? meta.rotation : false })}>{meta.idea ? 'Mark ready' : 'Mark as idea'}</button>
          {!meta.archived && !meta.idea && <button onClick={() => changeMeta({ ...meta, rotation: !meta.rotation })}>{meta.rotation ? 'Remove from rotation' : 'Add to rotation'}</button>}
          <button onClick={() => changeMeta({ ...meta, archived: !meta.archived, rotation: meta.archived ? meta.rotation : false })}>{meta.archived ? 'Restore recipe' : 'Archive recipe'}</button>
        </div>
        <RecipeMarkdown text={recipe.markdown} omitLeadingTitle/>
        <button className="recipe-detail-delete" onClick={remove}>Delete recipe</button>
      </div>
    </div>
  </dialog>
}
