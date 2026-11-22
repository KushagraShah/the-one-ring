import { useEffect, useRef } from 'react'
import { confirmAction } from '../AppDialog'
import type { SaveStatus } from './online'

export function RecipeRecovery({ status, retry, exportRecipes, exportDrafts, exportWorkout, exportHabits }: { status: SaveStatus; retry: () => void; exportRecipes: () => void; exportDrafts?: () => void; exportWorkout: () => void; exportHabits: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = dialog.current; if (!element) return; element.showModal(); return () => { if (element.open) element.close() } }, [])
  return <dialog ref={dialog} className="app-dialog recipe-recovery-dialog" aria-labelledby="recipe-recovery-title" onCancel={event => event.preventDefault()}>
    <h2 id="recipe-recovery-title">{status === 'conflict' ? 'Recipes changed elsewhere' : 'Could not save recipes'}</h2>
    <p>Recipe changes are not confirmed. Keep this page open and export them before reloading. Reloading can discard unsaved changes in other apps too.</p>
    {exportDrafts && <p>Recipe, side and shopping text still being edited is not included in the recipe backup. Export the text drafts separately if needed.</p>}
    <div className="recipe-recovery-actions">
      {status === 'error' && <button className="primary" onClick={retry}>Retry recipe save</button>}
      <button className="outline-button" onClick={exportRecipes}>Export unsaved recipes</button>
      {exportDrafts && <button className="outline-button" onClick={exportDrafts}>Export text drafts</button>}
      <button className="outline-button" onClick={exportWorkout}>Export workouts</button>
      <button className="outline-button" onClick={exportHabits}>Export habits</button>
      <button className="outline-button" onClick={async () => { if (await confirmAction('Discard all unsaved changes across apps and reload? Export them first.', 'Discard and reload')) window.location.reload() }}>Discard and reload</button>
    </div>
  </dialog>
}
