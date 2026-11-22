import { useEffect, useRef, useState } from 'react'
import { confirmAction } from '../AppDialog'
import { InfoTip } from '../InfoTip'
import { importRecipe } from './importRecipe'
import { contentMarkdown, emptyContent, type Nutrition, type RecipeContent } from './model'
import { RecipeMarkdown } from './RecipeMarkdown'

export type GuidedDraft = { id: string | null; content: RecipeContent; source: string; importText: string; initial: string; importWarnings?: string[] }
type Props = { draft: GuidedDraft; change: (next: GuidedDraft) => void; close: () => void; save: (asIdea?: boolean) => void }
type Page = 'basics' | 'nutrition' | 'ingredients' | 'instructions' | 'notes' | 'import' | 'review'
export function GuidedEditor({ draft, change, close, save }: Props) {
  const [page, setPage] = useState<Page>('basics')
  const [warnings, setWarnings] = useState<string[]>(draft.importWarnings || [])
  const [error, setError] = useState('')
  const [sourceOpen, setSourceOpen] = useState(false)
  const sourceDialog = useRef<HTMLDialogElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const content = draft.content
  const set = (patch: Partial<RecipeContent>) => change({ ...draft, content: { ...content, ...patch } })
  const setNutrition = (key: keyof Nutrition, value: string) => set({ nutrition: { ...content.nutrition, [key]: value } })
  const initialContent = (JSON.parse(draft.initial) as { content: RecipeContent }).content
  const macroReminder = !!draft.id && JSON.stringify([content.fresh, content.pantry, content.portions]) !== JSON.stringify([initialContent.fresh, initialContent.pantry, initialContent.portions]) && JSON.stringify(content.nutrition) === JSON.stringify(initialContent.nutrition)
  useEffect(() => { const el = dialog.current; if (!el) return; el.showModal(); return () => { if (el.open) el.close() } }, [])
  useEffect(() => { heading.current?.focus() }, [page])
  useEffect(() => { const el = sourceDialog.current; if (sourceOpen && el && !el.open) el.showModal(); return () => { if (el?.open) el.close() } }, [sourceOpen])
  const pages: { key: Page; title: string }[] = [{ key: 'basics', title: 'Basics' }, { key: 'nutrition', title: 'Nutrition' }, { key: 'ingredients', title: 'Ingredients' }, { key: 'instructions', title: 'Steps' }, { key: 'notes', title: 'Notes' }, { key: 'review', title: 'Review' }]
  return <dialog ref={dialog} className="recipe-detail-dialog recipe-editor-dialog" aria-labelledby="guided-title" onCancel={e => { if (e.target !== e.currentTarget) return; e.preventDefault(); close() }}>
    <div className="recipe-detail-shell"><header className="recipe-detail-top"><span>RECIPE EDITOR</span><button className="recipe-detail-close" aria-label="Close guided editor" onClick={close}>×</button></header>
      <div className="recipe-detail-body"><section className="recipe-panel recipe-guided">
        <h2 id="guided-title" ref={heading} tabIndex={-1}>{page === 'import' ? 'Import recipe' : pages.find(p => p.key === page)?.title}</h2>
        <nav className="recipe-library-views" aria-label="Recipe editor sections">{pages.map(p => <button key={p.key} aria-current={page === p.key ? 'page' : undefined} onClick={() => setPage(p.key)}>{p.title}</button>)}</nav>
        {page === 'basics' && <><label>Recipe name<input value={content.title} onChange={e => set({ title: e.target.value })}/></label><label>Short description<textarea rows={2} value={content.description} onChange={e => set({ description: e.target.value })}/></label><label>Portions or yield<input placeholder="e.g. 4 portions" value={content.portions} onChange={e => set({ portions: e.target.value })}/></label><div className="recipe-actions"><button onClick={() => setPage('import')}>Import Markdown or JSON</button></div></>}
        {page === 'nutrition' && <><div className="recipe-info-heading"><p>Values per portion</p><InfoTip label="About entering nutrition">Enter your own values, including ranges or approximations such as ~20 or 20–25. Nothing is calculated from ingredients. Describe what one portion includes so a side is not counted twice.</InfoTip></div><label>What does one portion cover?<input placeholder="e.g. curry only" value={content.nutrition.scope} onChange={e => setNutrition('scope', e.target.value)}/></label>{(['calories', 'protein', 'carbs', 'fat'] as const).map(k => <label key={k}>{k === 'calories' ? 'Calories (kcal)' : `${k[0].toUpperCase()}${k.slice(1)} (g)`}<input placeholder="e.g. ~20 or 20–25" value={content.nutrition[k]} onChange={e => setNutrition(k, e.target.value)}/></label>)}</>}
        {page === 'ingredients' && <><p>One ingredient per line. Quantities are kept exactly as written.</p><label>Fresh / weekly<textarea rows={7} value={content.fresh.join('\n')} onChange={e => set({ fresh: e.target.value.split('\n') })}/></label><label>Pantry / shelf<textarea rows={6} value={content.pantry.join('\n')} onChange={e => set({ pantry: e.target.value.split('\n') })}/></label></>}
        {page === 'instructions' && <><p>Each major step stays together during cooking. Paragraphs and nested Markdown lists are supported.</p>{content.steps.map((step, i) => <div className="guided-step" key={i}><label>Step {i + 1}<textarea rows={6} value={step} onChange={e => set({ steps: content.steps.map((s, j) => i === j ? e.target.value : s) })}/></label><button onClick={async () => { if (step.trim() && !await confirmAction(`Remove step ${i + 1} from this draft?`, 'Remove step')) return; set({ steps: content.steps.filter((_, j) => i !== j) }) }}>Remove step {i + 1}</button></div>)}<button onClick={() => set({ steps: [...content.steps, ''] })}>Add step</button></>}
        {page === 'notes' && <><div className="recipe-info-heading"><strong>Cooking reference</strong><InfoTip label="About quick glance">Quick glance stays beside the current cooking step. Add the quantities, timings or reminders you want nearby. It uses exactly what you write here.</InfoTip></div><label>Quick glance<textarea rows={5} value={content.quickGlance} onChange={e => set({ quickGlance: e.target.value })}/></label><label>Notes and serving ideas<textarea rows={8} value={content.notes} onChange={e => set({ notes: e.target.value })}/></label></>}
        {page === 'import' && <>
          <p>Paste a Notion/Markdown recipe or a recipe JSON object. Import replaces the current editor fields; the pasted source is retained with the recipe.</p>
          <label>Markdown or JSON<textarea rows={14} value={draft.importText} onChange={e => change({ ...draft, importText: e.target.value })}/></label>
          {error && <p role="alert">{error}</p>}
          <div className="recipe-actions"><button onClick={() => setPage('basics')}>Cancel import</button><button className="recipe-primary" disabled={!draft.importText.trim()} onClick={async () => {
            if (JSON.stringify(content) !== JSON.stringify(emptyContent()) && !await confirmAction('Replace the current editor fields and retained source with this import?', 'Replace editor fields')) return
            try { const result = importRecipe(draft.importText); change({ ...draft, content: result.content, source: draft.importText, importWarnings: result.warnings }); setWarnings(result.warnings); setError(''); setPage('review') }
            catch (e) { setError(e instanceof Error ? e.message : 'Could not read this import.') }
          }}>Review imported recipe</button></div>
          <p>JSON fields: title, description, portions, nutrition (scope, calories, protein, carbs, fat), quickGlance, fresh, pantry, steps, notes. Use strings; fresh, pantry and steps are arrays of strings.</p>
        </>}
        {page === 'review' && <>
          <p>Review the recipe before saving.</p>
          {warnings.length > 0 && <div className="recipe-warning"><strong>Check imported content</strong><ul>{warnings.map(w => <li key={w}>{w}</li>)}</ul><button onClick={() => { setWarnings([]); change({ ...draft, importWarnings: [] }) }}>I checked and corrected the fields</button></div>}
          <div className="recipe-review-summary"><p><strong>{content.title || 'Name required'}</strong> · {content.portions || 'Portions not added'}</p><p>{content.fresh.filter(Boolean).length + content.pantry.filter(Boolean).length} ingredients · {content.steps.filter(Boolean).length} steps</p>{macroReminder && <p className="recipe-macro-reminder">Ingredients or portions changed; check the saved macros. They are not recalculated.</p>}</div>
          {draft.source && <div className="recipe-actions"><button onClick={() => setSourceOpen(true)}>Compare original import</button></div>}
          <RecipeMarkdown text={contentMarkdown(content)}/>
          <div className="recipe-actions"><button onClick={() => setPage('basics')}>Edit fields</button><button className="recipe-primary" disabled={!content.title.trim()} onClick={() => save()}>Save recipe</button><button disabled={!content.title.trim()} onClick={() => save(true)}>Save as idea</button></div>
        </>}
        {page !== 'review' && page !== 'import' && <div className="recipe-actions"><button className="recipe-primary" onClick={() => setPage('review')}>Review recipe</button><button onClick={close}>Cancel</button></div>}
      </section></div>
    </div>
    {sourceOpen && <dialog ref={sourceDialog} className="recipe-detail-dialog" aria-label="Original import" onCancel={e => { e.preventDefault(); setSourceOpen(false) }}><div className="recipe-detail-shell"><header className="recipe-detail-top"><span>ORIGINAL IMPORT</span><button className="recipe-detail-close" aria-label="Close original import" onClick={() => setSourceOpen(false)}>×</button></header><div className="recipe-detail-body"><p>Original source; editor changes appear in the review.</p><pre className="recipe-document">{draft.source}</pre></div></div></dialog>}
  </dialog>
}
