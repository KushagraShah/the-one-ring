import { useEffect, useRef, useState } from 'react'
import { recipeView, type Recipe, type RecipeMeta } from './model'
import { RecipeMarkdown } from './RecipeMarkdown'

export function RecipeDetail({ recipe, close, edit, guidedEdit, start, remove, meta, changeMeta, addToPlan }: { recipe: Recipe; close: () => void; edit: () => void; guidedEdit: () => void; start: () => void; remove: () => void; meta: RecipeMeta; changeMeta: (meta: RecipeMeta) => void; addToPlan: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const parsed = recipeView(recipe)
  const [sourceOpen, setSourceOpen] = useState(false)
  const sourceDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    title.current?.focus()
    return () => { if (element.open) element.close() }
  }, [])
  useEffect(() => { const el = sourceDialog.current; if (sourceOpen && el && !el.open) el.showModal(); return () => { if (el?.open) el.close() } }, [sourceOpen])
  return <dialog ref={dialog} className="recipe-detail-dialog" aria-labelledby="recipe-detail-title" onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); close() }}>
    <div className="recipe-detail-shell">
      <header className="recipe-detail-top"><span>RECIPE BOOK</span><button type="button" className="recipe-detail-close" aria-label="Close recipe" onClick={close}>×</button></header>
      <div className="recipe-detail-body">
        <div className="recipe-detail-title"><span className="recipe-kicker">YOUR RECIPE</span><h2 id="recipe-detail-title" ref={title} tabIndex={-1}>{parsed.title}</h2>{parsed.portions && <p>Portions: {parsed.portions}</p>}</div>
        <div className="recipe-detail-macros"><span>PER PORTION{recipe.content?.nutrition.scope ? ` · ${recipe.content.nutrition.scope}` : ''}</span><p>{parsed.macros || 'Macros per portion not specified'}</p></div>
        <div className="recipe-detail-actions">{!meta.idea && !meta.archived && <><button className="recipe-detail-start" onClick={start}>Start cooking</button><button onClick={addToPlan}>Add to plan</button></>}<button onClick={edit}>Edit recipe</button></div>
        {!recipe.content && <div className="recipe-detail-actions"><button onClick={guidedEdit}>Convert to guided draft</button></div>}
        <div className="recipe-detail-actions">
          <button onClick={() => changeMeta({ ...meta, idea: !meta.idea, rotation: meta.idea ? meta.rotation : false })}>{meta.idea ? 'Mark ready' : 'Mark as idea'}</button>
          {!meta.archived && !meta.idea && <button onClick={() => changeMeta({ ...meta, rotation: !meta.rotation })}>{meta.rotation ? 'Remove from rotation' : 'Add to rotation'}</button>}
          <button onClick={() => changeMeta({ ...meta, archived: !meta.archived, rotation: meta.archived ? meta.rotation : false })}>{meta.archived ? 'Restore recipe' : 'Archive recipe'}</button>
        </div>
        <RecipeMarkdown text={recipe.markdown} omitLeadingTitle/>
        {recipe.source && <><div className="recipe-detail-actions"><button onClick={() => setSourceOpen(true)}>View original import</button></div>{sourceOpen && <dialog ref={sourceDialog} className="recipe-detail-dialog" aria-label="Original import" onCancel={e => { e.preventDefault(); setSourceOpen(false) }}><div className="recipe-detail-shell"><header className="recipe-detail-top"><span>ORIGINAL IMPORT</span><button className="recipe-detail-close" aria-label="Close original import" onClick={() => setSourceOpen(false)}>×</button></header><div className="recipe-detail-body"><p>This is the original source, not the edited recipe.</p><pre className="recipe-document">{recipe.source}</pre></div></div></dialog>}</>}
        <button className="recipe-detail-delete" onClick={remove}>Delete recipe</button>
      </div>
    </div>
  </dialog>
}
