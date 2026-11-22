import { useEffect, useRef } from 'react'
import { RecipeMarkdown } from './RecipeMarkdown'

export function CookingRecipeWindow({ title, markdown, close }: { title: string; markdown: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    heading.current?.focus()
    return () => { if (element.open) element.close() }
  }, [])
  return <dialog ref={dialog} className="recipe-detail-dialog" aria-labelledby="cooking-recipe-title" onCancel={event => { event.preventDefault(); close() }}>
    <div className="recipe-detail-shell">
      <header className="recipe-detail-top"><span>COOKING · FULL RECIPE</span><button type="button" className="recipe-detail-close" aria-label="Close full recipe" onClick={close}>×</button></header>
      <div className="recipe-detail-body">
        <div className="recipe-detail-title"><h2 id="cooking-recipe-title" ref={heading} tabIndex={-1}>{title}</h2></div>
        <RecipeMarkdown text={markdown} omitLeadingTitle/>
      </div>
    </div>
  </dialog>
}
