import { confirmAction, showMessage } from '../AppDialog'
import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowLeft, BookOpen, ChevronRight, Dumbbell, Home, ListChecks, MoreHorizontal, RotateCcw, Settings2 } from 'lucide-react'
import { Home as HomeScreen } from './Home'
import { AvatarImage, avatars } from './avatars'
import { AvatarPicker } from './AvatarPicker'
import { version as appVersion } from '../../package.json'
import { HabitApp, type HabitHandle } from '../habits/HabitApp'
import { parseHabits } from '../habits/model'
import { WorkspaceGate, type WorkoutHandle } from '../workout/WorkoutApp'
import { useAppUpdate } from './useAppUpdate'
import { supabase } from '../auth'
import { RecipeApp, type RecipeHandle } from '../recipes/RecipeApp'
import { parseRecipeData, type RecipeData } from '../recipes/model'
import { FULL_BACKUP_FILE_LIMIT } from '../backupLimits'
import { SaveRecovery, type RecoveryStatus } from './SaveRecovery'
import { RecoveryBoundary } from './RecoveryBoundary'
import { DraftContext, DraftRegistry } from './DraftCapture'

type Identity = { id: string; email: string; demo: boolean; username: string; avatar: string }
type View = 'home' | 'workout' | 'habits' | 'recipes' | 'settings'

export function App({ identity, signOut }: { identity: Identity; signOut: () => Promise<void> }) {
  const [view, setView] = useState<View>('home')
  const [profile, setProfile] = useState(() => ({ username: identity.username, avatar: identity.avatar }))
  const [savedProfile, setSavedProfile] = useState(() => ({ username: identity.username, avatar: identity.avatar }))
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [backupsOpen, setBackupsOpen] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const profileDirty = profile.username !== savedProfile.username || profile.avatar !== savedProfile.avatar
  const previewAvatar = avatars.find(item => item.id === profile.avatar)
  const displayName = savedProfile.username.trim() || identity.email
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (profileDirty || profileBusy) event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [profileDirty, profileBusy])
  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) { setProfileMessage('Enter a username of up to 40 characters.'); return }
    const username = profile.username.trim()
    if (!username || username.length > 40) { setProfileMessage('Enter a username of up to 40 characters.'); return }
    const next = { username, avatar: profile.avatar }
    setProfileBusy(true); setProfileMessage('')
    try {
      if (!identity.demo) {
        if (!supabase) throw new Error('Account connection is unavailable.')
        const { error } = await supabase.auth.updateUser({ data: next })
        if (error) throw error
      }
      setProfile(next); setSavedProfile(next); setProfileMessage(identity.demo ? 'Saved for this demo.' : 'Profile saved.')
    } catch { setProfileMessage('Could not save your profile. Check your connection and try again.') }
    finally { setProfileBusy(false) }
  }
  const workout = useRef<WorkoutHandle>(null)
  const habits = useRef<HabitHandle>(null)
  const recipes = useRef<RecipeHandle>(null)
  const [workoutStatus, setWorkoutStatus] = useState<RecoveryStatus>('saved')
  const [habitStatus, setHabitStatus] = useState<RecoveryStatus>('saved')
  const [recipeStatus, setRecipeStatus] = useState<RecoveryStatus>('saved')
  const [reviewingRecovery, setReviewingRecovery] = useState(false)
  const draftRegistry = useRef(new DraftRegistry())
  const recoveryOpen = [workoutStatus, habitStatus, recipeStatus].some(status => status === 'error' || status === 'conflict')
  const update = useAppUpdate()
  const [updateMessage, setUpdateMessage] = useState('')
  const guardUpdate = () => {
    if (identity.demo) { setUpdateMessage('Exit demo mode before updating; demo data is temporary and would be lost.'); return false }
    if (profileDirty || profileBusy || !workout.current || !habits.current || !recipes.current || !workout.current.canUpdate() || !habits.current.canSignOut() || !recipes.current.canLeave()) { setUpdateMessage('Finish or cancel edits, leave workout editing and wait for saves before updating, then try again.'); return false }
    setUpdateMessage('')
    return true
  }
  const guardUpdateRef = useRef(guardUpdate)
  guardUpdateRef.current = guardUpdate
  const applyUpdate = () => { void update.activate(() => guardUpdateRef.current()) }
  const navigate = async (next: View) => {
    if (next === view) { if (next === 'workout') workout.current?.open(); if (next === 'settings') { setBackupsOpen(false); setAvatarPickerOpen(false); setCreditsOpen(false) }; return }
    if (view === 'settings' && (profileBusy || (profileDirty && !await confirmAction('Discard unsaved profile changes?', 'Discard changes')))) return
    if (view === 'settings' && profileDirty) { setProfile(savedProfile); setProfileMessage('') }
    if (view === 'settings') { setAvatarPickerOpen(false); setBackupsOpen(false); setCreditsOpen(false) }
    const apply = () => { if (next === 'workout') workout.current?.open(); setView(next) }
    if (view === 'workout' && workout.current) workout.current.leave(apply)
    else if (view === 'habits' && habits.current) habits.current.leave(apply)
    else if (view === 'recipes' && recipes.current) recipes.current.leave(apply)
    else apply()
  }
  const exit = async () => {
    if (signOutBusy) return
    if (profileBusy || (profileDirty && !await confirmAction('Discard unsaved profile changes?', 'Discard changes'))) return
    if (!workout.current || !habits.current || !recipes.current || !workout.current.canSignOut() || !habits.current.canSignOut() || !recipes.current.canLeave()) { void showMessage('Finish your edits and wait for saves before signing out.'); return }
    setSignOutBusy(true)
    try { await signOut() }
    catch { void showMessage('Could not sign out. Your session may still be active. Check your connection and try signing out again.') }
    finally { setSignOutBusy(false) }
  }
  const exportFull = () => {
    const w = workout.current; const h = habits.current; const data = h?.snapshot()
    if (!w || !h || !data || !w.canSignOut() || !h.canSignOut()) { void showMessage('Both apps must be loaded and saved before exporting a full backup.'); return }
    const exportedAt = new Date().toISOString()
    const file = { scope: 'full', format: 1, exportedAt, workouts: w.snapshot(), habits: data }
    const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `one-ring-full-${exportedAt.replace(/[:.]/g, '-')}.json`; link.click(); URL.revokeObjectURL(url)
  }
  const restoreFull = async (file?: File) => {
    if (!file) return
    const w = workout.current; const h = habits.current
    if (!w || !h || !h.snapshot() || !w.canSignOut() || !h.canSignOut()) { void showMessage('Both apps must be loaded and saved before restoring.'); return }
    const baseline = JSON.stringify([w.snapshot(), h.snapshot()])
    const unchanged = () => {
      const currentW = workout.current; const currentH = habits.current
      return !!currentW && !!currentH && !!currentH.snapshot() && currentW.canSignOut() && currentH.canSignOut() && JSON.stringify([currentW.snapshot(), currentH.snapshot()]) === baseline
    }
    let workoutData: ReturnType<WorkoutHandle['validateBackup']>; let habitData: ReturnType<typeof parseHabits>
    try {
      if (file.size > FULL_BACKUP_FILE_LIMIT) throw new Error('Too large')
      const value = JSON.parse(await file.text())
      if (value.scope !== 'full' || value.format !== 1) throw new Error('Wrong scope')
      workoutData = w.validateBackup(value.workouts); habitData = parseHabits(JSON.stringify(value.habits))
    } catch { void showMessage('Invalid full backup or backup exceeds the 600 MB file or 50 MB per-workspace limit. Neither app was changed.'); return }
    if (!unchanged()) { void showMessage('App data or edits changed while reading. Finish saving and try again.'); return }
    if (!await confirmAction('Replace BOTH workout and habit data? Export a full backup first. Each app saves separately: a failure may leave only one restored. Keep this page open and follow any save errors.')) return
    if (!unchanged()) { void showMessage('App data or edits changed while confirming. Finish saving and try again.'); return }
    try { workout.current!.replace(workoutData); habits.current!.replace(habitData); void showMessage('Restore started. The two apps save separately; wait for both saving indicators and address any errors before leaving.') }
    catch { void showMessage('Restore could not finish. One app may have changed. Keep this page open, inspect both apps and export their data before retrying.') }
  }
  const exportAllApps = () => {
    const w = workout.current; const h = habits.current; const r = recipes.current
    const habitData = h?.snapshot(); const recipeData = r?.snapshot()
    if (!w || !h || !r || !habitData || !recipeData || !w.canSignOut() || !h.canSignOut() || !r.canLeave()) { void showMessage('All three apps must be loaded and saved before exporting a full backup.'); return }
    const exportedAt = new Date().toISOString()
    const file = { scope: 'full', format: 2, exportedAt, workouts: w.snapshot(), habits: habitData, recipes: recipeData }
    const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `one-ring-full-${exportedAt.replace(/[:.]/g, '-')}.json`; link.click(); URL.revokeObjectURL(url)
  }
  const restoreAllApps = async (file?: File) => {
    if (!file) return
    const w = workout.current; const h = habits.current; const r = recipes.current
    if (!w || !h || !r || !h.snapshot() || !r.snapshot() || !w.canSignOut() || !h.canSignOut() || !r.canLeave()) { void showMessage('All three apps must be loaded and saved before restoring a full backup.'); return }
    const baseline = JSON.stringify([w.snapshot(), h.snapshot(), r.snapshot()])
    const unchanged = () => {
      const currentW = workout.current; const currentH = habits.current; const currentR = recipes.current
      return !!currentW && !!currentH && !!currentR && !!currentH.snapshot() && !!currentR.snapshot() && currentW.canSignOut() && currentH.canSignOut() && currentR.canLeave() && JSON.stringify([currentW.snapshot(), currentH.snapshot(), currentR.snapshot()]) === baseline
    }
    let workoutData: ReturnType<WorkoutHandle['validateBackup']>; let habitData: ReturnType<typeof parseHabits>; let recipeData: RecipeData
    try {
      if (file.size > FULL_BACKUP_FILE_LIMIT) throw Error('Too large')
      const value = JSON.parse(await file.text())
      if (value.scope !== 'full' || value.format !== 2) throw Error('Wrong scope')
      workoutData = w.validateBackup(value.workouts); habitData = parseHabits(JSON.stringify(value.habits)); recipeData = parseRecipeData(JSON.stringify(value.recipes))
    } catch { void showMessage('Invalid three-app backup or backup exceeds the 600 MB file or 50 MB per-workspace limit. No app data was changed. Older workout and habit backups can be restored separately.'); return }
    if (!unchanged()) { void showMessage('App data or edits changed while reading. Finish saving and try again.'); return }
    if (!await confirmAction('Replace workout, habit and recipe data, including active recipe phases? Each app saves separately; a failure may leave only some restored. Keep this page open and follow save errors.', 'Restore full backup')) return
    if (!unchanged()) { void showMessage('App data or edits changed while confirming. Finish saving and try again.'); return }
    try { workout.current!.replace(workoutData); habits.current!.replace(habitData); recipes.current!.replace(recipeData); void showMessage('Restore started. The three apps save separately; wait for all saving indicators and address any errors before leaving.') }
    catch { void showMessage('Restore could not finish. Some apps may have changed. Keep this page open, inspect each app and export its data before retrying.') }
  }
  return <DraftContext.Provider value={draftRegistry.current}><div className="app-shell" data-view={view} data-theme={view === 'workout' ? 'workout' : view === 'habits' ? 'habits' : view === 'recipes' ? 'recipes' : 'neutral'}>
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><span /></span><span>the one ring<small>YOUR SPACE TO GROW</small></span></div><div className="sidebar-label">YOUR SPACE</div><button className={`side-link ${view === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><Home size={18}/> Home</button><div className="sidebar-app-label">YOUR APPS</div><AppStrip view={view} navigate={navigate}/><div className="sidebar-bottom"><button className="profile" onClick={() => navigate('settings')}><span className="avatar"><AvatarImage id={savedProfile.avatar}/></span><span><strong>{displayName}</strong><small>{identity.demo ? 'Demo mode' : 'Account'}</small></span><MoreHorizontal size={19}/></button></div></aside>
    <main className="main"><header className="topbar"><div className="mobile-brand"><span className="brand-mark"><span/></span> the one ring</div><div className="breadcrumb">YOUR SPACE <ChevronRight size={13}/> <span>{view === 'home' ? 'Overview' : view === 'settings' ? 'Settings' : view === 'habits' ? 'Habit Tracker' : view === 'recipes' ? 'Recipe Book' : 'Workout Tracker'}</span></div><button className="top-profile" onClick={() => navigate('settings')}>{identity.demo ? 'Demo mode' : 'Account'} <span className="avatar small"><AvatarImage id={savedProfile.avatar}/></span></button></header>
    <div className="content">
      {(update.status === 'available' || update.status === 'activated' || update.status === 'activating') && <div className="app-update" role="status"><div><strong>{update.status === 'activating' ? 'Updating app…' : update.status === 'activated' ? 'Update ready to open' : 'An update is available'}</strong><p>{update.status === 'activating' ? 'Waiting for the update to activate…' : 'Update when your edits are saved.'}</p>{(updateMessage || update.message) && <p>{updateMessage || update.message}</p>}</div><button className="outline-button" disabled={update.status === 'activating'} onClick={applyUpdate}>{update.status === 'activating' ? 'Updating…' : 'Update app'}</button></div>}
      {view === 'home' && <HomeScreen open={next => void navigate(next)}/>}
      {view === 'settings' && <div hidden={backupsOpen || avatarPickerOpen || creditsOpen}><div className="page-heading"><div><h1>Settings<span className="accent">.</span></h1></div></div><div className="settings-card"><div className="settings-row"><span className="avatar" aria-hidden="true"><AvatarImage id={profile.avatar}/></span><div><strong>{displayName}</strong><small>{identity.demo ? 'Temporary demo' : identity.email}</small></div></div><div className="detail-divider"/><form noValidate className="profile-form" onSubmit={saveProfile}><label>Username<input required maxLength={40} autoComplete="nickname" value={profile.username} onChange={event => setProfile({ ...profile, username: event.target.value })}/></label><div className="profile-avatar-choice"><div><strong>Avatar</strong><small>{previewAvatar?.label || 'Current avatar'}</small></div><button className="outline-button" type="button" onClick={() => setAvatarPickerOpen(true)}>Choose avatar</button></div><button className="outline-button" type="submit" disabled={profileBusy || !profileDirty}>{profileBusy ? 'Saving…' : 'Save profile'}</button>{profileMessage && <p role="status">{profileMessage}</p>}</form><div className="demo-warning"><p>{identity.demo ? 'Demo data is temporary and resets on refresh.' : 'Your account data is saved to Supabase. An internet connection is required.'}</p></div><button className="outline-button signout" onClick={exit}>{identity.demo ? 'Exit demo' : 'Sign out'}</button></div><button className="settings-backups-link" onClick={() => setBackupsOpen(true)}><span><strong>Backups</strong><small>Export or restore app data</small></span><ChevronRight size={20} aria-hidden="true"/></button><button className="settings-backups-link" onClick={() => setCreditsOpen(true)}><span><strong>Artwork credits</strong><small>Artists and sources</small></span><ChevronRight size={20} aria-hidden="true"/></button></div>}
      {view === 'settings' && avatarPickerOpen && <AvatarPicker value={profile.avatar} choose={id => setProfile({ ...profile, avatar: id })} back={() => setAvatarPickerOpen(false)}/>}
      {view === 'settings' && backupsOpen && <div className="backup-page-heading"><button className="text-button" onClick={() => setBackupsOpen(false)}>← Settings</button><div className="page-heading"><div><h1>Backups<span className="accent">.</span></h1><p>Choose which app data to export or restore.</p></div></div></div>}
      {view === 'settings' && creditsOpen && <section className="artwork-credits" aria-labelledby="artwork-credits-heading"><button className="ring-back" onClick={() => setCreditsOpen(false)}><ArrowLeft size={18} aria-hidden="true"/> Settings</button><div className="page-heading credits-heading"><div><h1 id="artwork-credits-heading">Artwork credits<span className="accent">.</span></h1><p>Artists and sources behind this space.</p></div></div><div className="settings-card"><h3>Flying dragon</h3><p>Artwork by <a href="https://openclipart.org/detail/315379/flying-dragon-silhouette-isolated">GDJ / Openclipart</a> · <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a></p></div></section>}
      <div className={view === 'settings' && (!backupsOpen || avatarPickerOpen || creditsOpen) ? 'backup-hidden' : undefined}>
      <RecoveryBoundary blocked={workoutStatus === 'error' || workoutStatus === 'conflict'} isBlockedNow={() => !!workout.current?.isRecoveryBlocked()} restoreDialogs={view === 'workout' && (!recoveryOpen || reviewingRecovery)}><WorkspaceGate ref={workout} identity={identity} view={view} onStatus={setWorkoutStatus}/></RecoveryBoundary>
      <RecoveryBoundary blocked={habitStatus === 'error' || habitStatus === 'conflict'} isBlockedNow={() => !!habits.current?.isRecoveryBlocked()} restoreDialogs={view === 'habits' && (!recoveryOpen || reviewingRecovery)}><HabitApp ref={habits} identity={identity} view={view} onStatus={setHabitStatus}/></RecoveryBoundary>
      <RecoveryBoundary blocked={recipeStatus === 'error' || recipeStatus === 'conflict'} isBlockedNow={() => !!recipes.current?.isRecoveryBlocked()} restoreDialogs={view === 'recipes' && (!recoveryOpen || reviewingRecovery)}><RecipeApp ref={recipes} identity={identity} view={view} onStatus={setRecipeStatus}/></RecoveryBoundary>
      {view === 'settings' && backupsOpen && <div className="settings-card backup-card"><h3>Workout and habit backup</h3><p>Includes workouts and habits only, not recipes. Restoring saves each app separately and may partially complete.</p><div className="settings-actions"><button className="outline-button" onClick={exportFull}><ArrowDownToLine size={16} aria-hidden="true"/> Export workout and habit backup</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore workout and habit backup<input type="file" accept="application/json,.json" onChange={event => { void restoreFull(event.target.files?.[0]); event.target.value = '' }}/></label></div></div>}
      {view === 'settings' && backupsOpen && <div className="settings-card backup-card"><h3>Full app backup</h3><p>Includes workouts, habits, recipes and active recipe phases. Apps restore separately and may partially complete.</p><div className="settings-actions"><button className="outline-button" onClick={exportAllApps}><ArrowDownToLine size={16} aria-hidden="true"/> Export full backup</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore full backup<input type="file" accept="application/json,.json" onChange={event => { void restoreAllApps(event.target.files?.[0]); event.target.value = '' }}/></label></div></div>}
      </div>
      {view === 'settings' && !backupsOpen && !avatarPickerOpen && !creditsOpen && <div className="settings-card update-settings"><h3>App updates</h3><p role="status">{({ unavailable: 'Update checks are unavailable in this browser or build.', checking: 'Checking for updates…', current: 'No update found.', available: 'An update is ready to install.', activating: 'Activating update…', activated: 'The update is ready to open.', error: 'Could not check for updates. Check your connection and try again.' })[update.status]}</p><button className="outline-button" disabled={update.status === 'unavailable' || update.status === 'checking' || update.status === 'activating'} onClick={() => void update.check()}>Check for updates</button></div>}
      {view === 'settings' && !backupsOpen && !avatarPickerOpen && !creditsOpen && <p className="app-version">The One Ring · v{appVersion}</p>}
    </div></main>
    <nav className="mobile-nav" aria-label="Main navigation"><button className={`mobile-fixed-nav ${view === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><Home size={19}/>Home</button><AppStrip view={view} navigate={navigate}/><button className={`mobile-fixed-nav ${view === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={19}/>Settings</button></nav>
    <SaveRecovery reviewing={reviewingRecovery} setReviewing={setReviewingRecovery} exportManualDrafts={() => draftRegistry.current.export()} apps={[
      { name: 'Workouts', status: workoutStatus, retry: () => workout.current?.retry(), exportData: () => workout.current?.exportData() },
      { name: 'Habits', status: habitStatus, retry: () => habits.current?.retry(), exportData: () => habits.current?.exportData() },
      { name: 'Recipes', status: recipeStatus, retry: () => recipes.current?.retry(), exportData: () => recipes.current?.exportData() },
    ]} exportDrafts={recipes.current?.hasDrafts() ? () => recipes.current?.exportDrafts() : undefined}/>
    {signOutBusy && <SignOutPending/>}
  </div></DraftContext.Provider>
}

function SignOutPending() {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="app-dialog app-message-dialog" aria-labelledby="signout-pending-title" onCancel={event => event.preventDefault()}><h2 id="signout-pending-title">Signing out…</h2><p role="status">Please wait while the account session is closed.</p></dialog>
}

function AppStrip({ view, navigate }: { view: View; navigate: (next: View) => void }) {
  return <div className="app-strip" role="group" aria-label="App rings; scroll to see unassigned rings" tabIndex={0} onKeyDown={event => {
    if (event.target !== event.currentTarget || event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return
    if (event.key === 'ArrowRight') event.currentTarget.scrollLeft += 70
    else if (event.key === 'ArrowLeft') event.currentTarget.scrollLeft -= 70
    else if (event.key === 'Home') event.currentTarget.scrollLeft = 0
    else if (event.key === 'End') event.currentTarget.scrollLeft = event.currentTarget.scrollWidth
    else return
    event.preventDefault()
  }}>
    <button className={`app-strip-button ${view === 'workout' ? 'active' : ''}`} aria-current={view === 'workout' ? 'page' : undefined} onClick={() => navigate('workout')}><span className="app-strip-icon"><Dumbbell size={16} aria-hidden="true"/></span><span>Workouts</span></button>
    <button className={`app-strip-button ${view === 'habits' ? 'active' : ''}`} aria-current={view === 'habits' ? 'page' : undefined} onClick={() => navigate('habits')}><span className="app-strip-icon"><ListChecks size={16} aria-hidden="true"/></span><span>Habits</span></button>
    <button className={`app-strip-button ${view === 'recipes' ? 'active' : ''}`} aria-current={view === 'recipes' ? 'page' : undefined} onClick={() => navigate('recipes')}><span className="app-strip-icon"><BookOpen size={16} aria-hidden="true"/></span><span>Recipes</span></button>
    {Array.from({ length: 6 }, (_, index) => <span className="app-strip-empty" role="img" aria-label={`App ring ${index + 4}, unassigned`} key={index}>{String(index + 4).padStart(2, '0')}</span>)}
  </div>
}
