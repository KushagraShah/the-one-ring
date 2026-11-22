import { useEffect, useRef } from 'react'
import { parseMarkdown } from './model'

type Editor = { id: string | null; markdown: string; original: string }
type Props = {
  editor: Editor
  review: boolean
  change: (markdown: string) => void
  setReview: (review: boolean) => void
  close: () => void
  save: () => void
  phaseWarning?: string
}

export function RecipeEditor({ editor, review, change, setReview, close, save, phaseWarning }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const parsed = parseMarkdown(editor.markdown)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    return () => { if (element.open) element.close() }
  }, [])
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0
    title.current?.focus()
  }, [review])
  return <dialog ref={dialog} className="recipe-detail-dialog recipe-editor-dialog" aria-labelledby="recipe-editor-title" onCancel={event => { event.preventDefault(); close() }}>
    <div className="recipe-detail-shell">
      <header className="recipe-detail-top"><span>{review ? 'RECIPE IMPORT' : 'RECIPE BOOK'}</span><button type="button" className="recipe-detail-close" aria-label="Close editor" onClick={close}>×</button></header>
      <div className="recipe-detail-body" ref={body}>
        {review ? <section className="recipe-panel recipe-review-screen">
          <h2 id="recipe-editor-title" ref={title} tabIndex={-1}>Review recipe</h2>
          <p>Check what was recognized before saving. The original Markdown is preserved.</p>
          <p className="recipe-warning">Extracted items may be incomplete. Compare the list and steps below with your Markdown before using them for shopping or cooking.</p>
          {parsed.warnings.length > 0 && <ul className="recipe-warning">{parsed.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
          {editor.id && <p className="recipe-warning">If ingredients or portions changed, review the authored per-portion macros. They are not recalculated.</p>}
          {phaseWarning && <p className="recipe-warning">{phaseWarning}</p>}
          <div className="recipe-review-summary"><p><strong>Title:</strong> {parsed.title || 'Missing — add a # heading'}</p><p><strong>Portions:</strong> {parsed.portions || 'Not recognized'}</p><p><strong>Macros per portion:</strong> {parsed.macros || 'Not recognized'}</p><p><strong>Quick glance:</strong> {parsed.quickGlance ? 'Included' : 'Not included'}</p></div>
          <h3>Ingredients · {parsed.ingredients.length}</h3><ul>{parsed.ingredients.map((item, index) => <li key={index}>{item.pantry ? 'Pantry · ' : ''}{item.text}</li>)}</ul>
          <h3>Instructions · {parsed.steps.length}</h3><ol>{parsed.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
          {(!parsed.ingredients.length || !parsed.steps.length) && <p>Some sections were not recognized. The full Markdown is still retained; check the template before shopping or cooking.</p>}
          <div className="recipe-actions"><button onClick={() => setReview(false)}>← Back to edit</button><button className="recipe-primary" disabled={!parsed.title} onClick={save}>Save recipe</button></div>
        </section> : <section className="recipe-panel recipe-editor">
          <h2 id="recipe-editor-title" ref={title} tabIndex={-1}>{editor.id ? 'Edit recipe' : 'Add recipe'}</h2>
          <p>Paste Markdown using the template. The original text is preserved.</p>
          <label>Recipe Markdown<textarea value={editor.markdown} onChange={event => change(event.target.value)} rows={16}/></label>
          <div className="recipe-actions"><button className="recipe-primary" onClick={() => setReview(true)}>Review recipe</button><button onClick={close}>Cancel</button></div>
        </section>}
      </div>
    </div>
  </dialog>
}
