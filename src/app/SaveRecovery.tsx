import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { confirmAction, useAppDialogActive } from '../AppDialog'

export type RecoveryStatus = 'saved' | 'saving' | 'error' | 'conflict'
type AppRecovery = { name: string; status: RecoveryStatus; retry: () => void; exportData: () => void }

export function SaveRecovery({ apps, exportDrafts, exportManualDrafts, reviewing, setReviewing }: { apps: AppRecovery[]; exportDrafts?: () => void; exportManualDrafts: () => void; reviewing: boolean; setReviewing: (value: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [activeDialog, setActiveDialog] = useState<HTMLDialogElement | null>(null)
  const appDialogActive = useAppDialogActive()
  const failures = apps.filter(app => app.status === 'error' || app.status === 'conflict')
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (failures.length && !reviewing && !appDialogActive && !element.open) element.showModal()
    else if ((!failures.length || reviewing || appDialogActive) && element.open) element.close()
    if (!failures.length) setReviewing(false)
  }, [failures.length, reviewing, appDialogActive])
  useEffect(() => {
    if (!reviewing) { setActiveDialog(null); return }
    const update = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).filter(item => item.matches(':modal') && item !== dialog.current && !item.classList.contains('app-message-dialog'))
      const focused = document.activeElement?.closest('dialog')
      setActiveDialog((focused instanceof HTMLDialogElement && dialogs.includes(focused) ? focused : dialogs[dialogs.length - 1]) || null)
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    document.addEventListener('focusin', update)
    return () => { observer.disconnect(); document.removeEventListener('focusin', update) }
  }, [reviewing])
  const returnControl = <div className="recovery-return" role="status"><span>Save recovery is still needed. Failed apps are locked; finish or preserve drafts before reloading.</span><button className="outline-button" onClick={() => setReviewing(false)}>Return to save recovery</button></div>
  return <>{reviewing && failures.length > 0 && (activeDialog ? createPortal(returnControl, activeDialog) : returnControl)}
  <dialog ref={dialog} className="app-dialog app-message-dialog save-recovery-card" aria-labelledby="save-recovery-title" onCancel={event => event.preventDefault()}>
    <h2 id="save-recovery-title">Save recovery</h2>
    <p>Keep this page open. Unconfirmed changes remain here. A failure may be due to the connection or the server's 10 MB request limit; retrying cannot fix an oversized request. Export before discarding anything.</p>
    {failures.map(app => <section key={app.name} aria-label={`${app.name} recovery`}>
      <h3>{app.status === 'conflict' ? ({ Workouts: 'Workout data changed elsewhere', Habits: 'Habits changed elsewhere', Recipes: 'Recipes changed elsewhere' } as Record<string, string>)[app.name] : ({ Workouts: 'Could not save workout data', Habits: 'Could not save habits', Recipes: 'Could not save recipes' } as Record<string, string>)[app.name]}</h3>
      <p>{app.status === 'conflict' ? 'Export your changes before reloading the latest server data.' : 'Check your connection and retry, or export your unsaved data.'}</p>
      {app.status === 'error' && <button className="primary" onClick={app.retry}>{app.name === 'Workouts' ? 'Retry save' : `Retry ${app.name === 'Habits' ? 'habit' : 'recipe'} save`}</button>}
    </section>)}
    <p>Workspace backups exclude unsaved editor drafts. Export workout and habit drafts separately for manual reference; draft exports cannot be restored as backups.</p>
    {apps.map(app => <button key={app.name} className="outline-button" onClick={app.exportData}>{app.name === 'Workouts' ? 'Export unsaved data' : `Export unsaved ${app.name.toLowerCase()}`}</button>)}
    {exportDrafts && <button className="outline-button" onClick={exportDrafts}>Export text drafts</button>}
    <button className="outline-button" onClick={exportManualDrafts}>Export workout and habit drafts</button>
    <button className="outline-button" onClick={() => setReviewing(true)}>Review other app drafts</button>
    <button className="outline-button" onClick={async () => { if (await confirmAction('Discard ALL unsaved changes and drafts across apps and reload? Export what you need first.', 'Discard and reload')) window.location.reload() }}>Discard and reload</button>
  </dialog></>
}
