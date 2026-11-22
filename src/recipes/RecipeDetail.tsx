import { useEffect, useRef, useState } from 'react'
import { Archive, FilePenLine, Lightbulb, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { InfoTip } from '../InfoTip'
import { recipeView, type Recipe, type RecipeMeta } from './model'
import { RecipeMarkdown } from './RecipeMarkdown'

export function RecipeDetail({ recipe, close, edit, guidedEdit, start, remove, meta, changeMeta, addToPlan }: { recipe: Recipe; close: () => void; edit: () => void; guidedEdit: () => void; start: () => void; remove: () => void; meta: RecipeMeta; changeMeta: (meta: RecipeMeta) => void; addToPlan: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const parsed = recipeView(recipe)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const optionsDialog = useRef<HTMLDialogElement>(null)
  const optionsTrigger = useRef<HTMLButtonElement>(null)
  const optionsTitle = useRef<HTMLHeadingElement>(null)
  const sourceDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    title.current?.focus()
    return () => { if (element.open) element.close() }
  }, [])
  useEffect(() => { const el = sourceDialog.current; if (sourceOpen && el && !el.open) el.showModal(); return () => { if (el?.open) el.close() } }, [sourceOpen])
  useEffect(() => {
    const el = optionsDialog.current
    if (!optionsOpen || !el) return
    el.showModal()
    optionsTitle.current?.focus()
    return () => { if (el.open) el.close(); optionsTrigger.current?.focus() }
  }, [optionsOpen])
  return <dialog ref={dialog} className="recipe-detail-dialog" aria-labelledby="recipe-detail-title" onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); close() }}>
    <div className="recipe-detail-shell">
      <header className="recipe-detail-top"><span>RECIPE BOOK</span><div className="recipe-header-tools"><button type="button" className="recipe-icon-button" aria-label="Edit recipe" onClick={edit}><Pencil size={19} aria-hidden="true"/></button><button ref={optionsTrigger} type="button" className="recipe-icon-button" aria-label="Recipe options" aria-haspopup="dialog" onClick={() => setOptionsOpen(true)}><MoreHorizontal size={22} aria-hidden="true"/></button><button type="button" className="recipe-detail-close" aria-label="Close recipe" onClick={close}>×</button></div></header>
      <div className="recipe-detail-body">
        <div className="recipe-detail-title"><span className="recipe-kicker">YOUR RECIPE</span><h2 id="recipe-detail-title" ref={title} tabIndex={-1}>{parsed.title}</h2>{parsed.portions && <p>Portions: {parsed.portions}</p>}</div>
        <div className="recipe-status-line"><span>{meta.archived ? 'Archived' : meta.idea ? 'Idea' : meta.rotation ? 'In rotation' : 'Ready'}</span><InfoTip label="About recipe status">{meta.archived ? 'Saved, but hidden from new plans. Restore it in Recipe options.' : meta.idea ? 'An unfinished recipe. Mark it ready to plan or cook it.' : meta.rotation ? 'A regular recipe used for meal suggestions.' : 'Ready to add to a plan or cook.'}</InfoTip></div>
        <div className="recipe-detail-macros"><div className="recipe-info-heading"><span>PER PORTION{recipe.content?.nutrition.scope ? ` · ${recipe.content.nutrition.scope}` : ''}</span><InfoTip label="About recipe macros">Entered per portion; ingredient edits don’t recalculate these values.</InfoTip></div><p>{parsed.macros || 'Macros per portion not specified'}</p></div>
        {!meta.idea && !meta.archived && <div className="recipe-detail-actions"><button className="recipe-detail-start" onClick={start}>Start cooking</button><button onClick={addToPlan}>Add to plan</button></div>}
        <RecipeMarkdown text={recipe.markdown} omitLeadingTitle/>
        {recipe.source && <><div className="recipe-detail-actions"><button onClick={() => setSourceOpen(true)}>View original import</button></div>{sourceOpen && <dialog ref={sourceDialog} className="recipe-detail-dialog" aria-label="Original import" onCancel={e => { e.preventDefault(); setSourceOpen(false) }}><div className="recipe-detail-shell"><header className="recipe-detail-top"><span>ORIGINAL IMPORT</span><button className="recipe-detail-close" aria-label="Close original import" onClick={() => setSourceOpen(false)}>×</button></header><div className="recipe-detail-body"><p>This is the original source, not the edited recipe.</p><pre className="recipe-document">{recipe.source}</pre></div></div></dialog>}</>}
      </div>
    </div>
    {optionsOpen && <dialog ref={optionsDialog} className="recipe-options-dialog recipe-detail-dialog" aria-labelledby="recipe-options-title" onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); setOptionsOpen(false) }}>
      <div className="recipe-detail-shell"><header className="recipe-detail-top"><span>RECIPE BOOK</span><button className="recipe-detail-close" aria-label="Close recipe options" onClick={() => setOptionsOpen(false)}>×</button></header><div className="recipe-detail-body">
        <h2 ref={optionsTitle} tabIndex={-1} id="recipe-options-title">Recipe options</h2>
        <p className="recipe-options-name">{parsed.title}</p>
        <div className="recipe-option-list">
          {!meta.archived && !meta.idea && <button onClick={() => changeMeta({ ...meta, rotation: !meta.rotation })}><RotateCcw size={20} aria-hidden="true"/>{meta.rotation ? 'Remove from rotation' : 'Add to rotation'}</button>}
          <button onClick={() => changeMeta({ ...meta, idea: !meta.idea, rotation: meta.idea ? meta.rotation : false })}><Lightbulb size={20} aria-hidden="true"/>{meta.idea ? 'Mark ready' : 'Mark as idea'}</button>
          <button onClick={() => changeMeta({ ...meta, archived: !meta.archived, rotation: meta.archived ? meta.rotation : false })}><Archive size={20} aria-hidden="true"/>{meta.archived ? 'Restore recipe' : 'Archive recipe'}</button>
          {!recipe.content && <button onClick={() => { setOptionsOpen(false); guidedEdit() }}><FilePenLine size={20} aria-hidden="true"/>Convert to guided draft</button>}
          <button className="recipe-option-delete" onClick={remove}><Trash2 size={20} aria-hidden="true"/>Delete recipe</button>
        </div>
      </div></div>
    </dialog>}
  </dialog>
}
