import { confirmAction, showMessage } from '../AppDialog'
import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowLeft, ChevronRight, Dumbbell, Home, ListChecks, MoreHorizontal, RotateCcw, Settings2 } from 'lucide-react'
import { Home as HomeScreen } from './Home'
import { AvatarImage, avatars } from './avatars'
import { AvatarPicker } from './AvatarPicker'
import { version as appVersion } from '../../package.json'
import { HabitApp, type HabitHandle } from '../habits/HabitApp'
import { parseHabits } from '../habits/model'
import { WorkspaceGate, type WorkoutHandle } from '../workout/WorkoutApp'
import { useAppUpdate } from './useAppUpdate'
import { supabase } from '../auth'

type Identity = { id: string; email: string; demo: boolean; username: string; avatar: string }
type View = 'home' | 'workout' | 'habits' | 'settings'

export function App({ identity, signOut }: { identity: Identity; signOut: () => void }) {
  const [view, setView] = useState<View>('home')
  const [profile, setProfile] = useState(() => ({ username: identity.username, avatar: identity.avatar }))
  const [savedProfile, setSavedProfile] = useState(() => ({ username: identity.username, avatar: identity.avatar }))
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
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
  const update = useAppUpdate()
  const [updateMessage, setUpdateMessage] = useState('')
  const applyUpdate = () => {
    if (identity.demo) { setUpdateMessage('Exit demo mode before updating; demo data is temporary and would be lost.'); return }
    if (profileDirty || profileBusy || !workout.current || !habits.current || !workout.current.canUpdate() || !habits.current.canSignOut()) { setUpdateMessage('Finish or cancel edits, leave workout editing and wait for saves before updating.'); return }
    setUpdateMessage('')
    update.activate()
  }
  const navigate = async (next: View) => {
    if (next === view) { if (next === 'workout') workout.current?.open(); if (next === 'settings') { setBackupsOpen(false); setAvatarPickerOpen(false); setCreditsOpen(false) }; return }
    if (view === 'settings' && (profileBusy || (profileDirty && !await confirmAction('Discard unsaved profile changes?')))) return
    if (view === 'settings' && profileDirty) { setProfile(savedProfile); setProfileMessage('') }
    if (view === 'settings') { setAvatarPickerOpen(false); setBackupsOpen(false); setCreditsOpen(false) }
    const apply = () => { if (next === 'workout') workout.current?.open(); setView(next) }
    if (view === 'workout' && workout.current) workout.current.leave(apply)
    else if (view === 'habits' && habits.current) habits.current.leave(apply)
    else apply()
  }
  const exit = async () => {
    if (profileBusy || (profileDirty && !await confirmAction('Discard unsaved profile changes?'))) return
    if ((workout.current && !workout.current.canSignOut()) || (habits.current && !habits.current.canSignOut())) { void showMessage('Finish your edits and wait for saves before signing out.'); return }
    signOut()
  }
  const exportFull = () => {
    const w = workout.current; const h = habits.current; const data = h?.snapshot()
    if (!w || !h || !data || !w.canSignOut() || !h.canSignOut()) { void showMessage('Both apps must be loaded and saved before exporting a full backup.'); return }
    const exportedAt = new Date().toISOString()
    const file = { scope: 'full', format: 1, exportedAt, workouts: w.snapshot(), habits: data }
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `one-ring-full-${exportedAt.replace(/[:.]/g, '-')}.json`; link.click(); URL.revokeObjectURL(url)
  }
  const restoreFull = async (file?: File) => {
    if (!file) return
    const w = workout.current; const h = habits.current
    if (!w || !h || !h.snapshot() || !w.canSignOut() || !h.canSignOut()) { void showMessage('Both apps must be loaded and saved before restoring.'); return }
    let workoutData: ReturnType<WorkoutHandle['validateBackup']>; let habitData: ReturnType<typeof parseHabits>
    try {
      if (file.size > 20_000_000) throw new Error('Too large')
      const value = JSON.parse(await file.text())
      if (value.scope !== 'full' || value.format !== 1) throw new Error('Wrong scope')
      workoutData = w.validateBackup(value.workouts); habitData = parseHabits(JSON.stringify(value.habits))
    } catch { void showMessage('Invalid full backup. Neither app was changed.'); return }
    if (!await confirmAction('Replace BOTH workout and habit data? Export a full backup first. Each app saves separately: a failure may leave only one restored. Keep this page open and follow any save errors.')) return
    try { w.replace(workoutData); h.replace(habitData); void showMessage('Restore started. The two apps save separately; wait for both saving indicators and address any errors before leaving.') }
    catch { void showMessage('Restore could not finish. One app may have changed. Keep this page open, inspect both apps and export their data before retrying.') }
  }
  return <div className="app-shell" data-view={view} data-theme={view === 'workout' ? 'workout' : view === 'habits' ? 'habits' : 'neutral'}>
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><span /></span><span>the one ring<small>YOUR SPACE TO GROW</small></span></div><div className="sidebar-label">YOUR SPACE</div><button className={`side-link ${view === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><Home size={18}/> Home</button><div className="sidebar-app-label">YOUR APPS</div><AppStrip view={view} navigate={navigate}/><div className="sidebar-bottom"><button className="profile" onClick={() => navigate('settings')}><span className="avatar"><AvatarImage id={savedProfile.avatar}/></span><span><strong>{displayName}</strong><small>{identity.demo ? 'Demo mode' : 'Account'}</small></span><MoreHorizontal size={19}/></button></div></aside>
    <main className="main"><header className="topbar"><div className="mobile-brand"><span className="brand-mark"><span/></span> the one ring</div><div className="breadcrumb">YOUR SPACE <ChevronRight size={13}/> <span>{view === 'home' ? 'Overview' : view === 'settings' ? 'Settings' : view === 'habits' ? 'Habit Tracker' : 'Workout Tracker'}</span></div><button className="top-profile" onClick={() => navigate('settings')}>{identity.demo ? 'Demo mode' : 'Account'} <span className="avatar small"><AvatarImage id={savedProfile.avatar}/></span></button></header>
    <div className="content">
      {(update.status === 'available' || update.status === 'activated') && <div className="app-update" role="status"><div><strong>{update.status === 'available' ? 'An update is available' : 'Update ready to open'}</strong><p>{update.status === 'available' ? 'Install when your edits are saved.' : 'Reload when your edits are saved.'}</p>{updateMessage && <p>{updateMessage}</p>}</div><button className="outline-button" onClick={applyUpdate}>{update.status === 'available' ? 'Prepare update' : 'Reload app'}</button></div>}
      {view === 'home' && <HomeScreen open={next => void navigate(next)}/>}
      {view === 'settings' && <div hidden={backupsOpen || avatarPickerOpen || creditsOpen}><div className="page-heading"><div><h1>Settings<span className="accent">.</span></h1></div></div><div className="settings-card"><div className="settings-row"><span className="avatar" aria-hidden="true"><AvatarImage id={profile.avatar}/></span><div><strong>{displayName}</strong><small>{identity.demo ? 'Temporary demo' : identity.email}</small></div></div><div className="detail-divider"/><form noValidate className="profile-form" onSubmit={saveProfile}><label>Username<input required maxLength={40} autoComplete="nickname" value={profile.username} onChange={event => setProfile({ ...profile, username: event.target.value })}/></label><div className="profile-avatar-choice"><div><strong>Avatar</strong><small>{previewAvatar?.label || 'Current avatar'}</small></div><button className="outline-button" type="button" onClick={() => setAvatarPickerOpen(true)}>Choose avatar</button></div><button className="outline-button" type="submit" disabled={profileBusy || !profileDirty}>{profileBusy ? 'Saving…' : 'Save profile'}</button>{profileMessage && <p role="status">{profileMessage}</p>}</form><div className="demo-warning"><p>{identity.demo ? 'Demo data is temporary and resets on refresh.' : 'Your account data is saved to Supabase. An internet connection is required.'}</p></div><button className="outline-button signout" onClick={exit}>{identity.demo ? 'Exit demo' : 'Sign out'}</button></div><button className="settings-backups-link" onClick={() => setBackupsOpen(true)}><span><strong>Backups</strong><small>Export or restore app data</small></span><ChevronRight size={20} aria-hidden="true"/></button><button className="settings-backups-link" onClick={() => setCreditsOpen(true)}><span><strong>Artwork credits</strong><small>Artists and sources</small></span><ChevronRight size={20} aria-hidden="true"/></button></div>}
      {view === 'settings' && avatarPickerOpen && <AvatarPicker value={profile.avatar} choose={id => setProfile({ ...profile, avatar: id })} back={() => setAvatarPickerOpen(false)}/>}
      {view === 'settings' && backupsOpen && <div className="backup-page-heading"><button className="text-button" onClick={() => setBackupsOpen(false)}>← Settings</button><div className="page-heading"><div><h1>Backups<span className="accent">.</span></h1><p>Choose which app data to export or restore.</p></div></div></div>}
      {view === 'settings' && creditsOpen && <section className="artwork-credits" aria-labelledby="artwork-credits-heading"><button className="ring-back" onClick={() => setCreditsOpen(false)}><ArrowLeft size={18} aria-hidden="true"/> Settings</button><div className="page-heading credits-heading"><div><h1 id="artwork-credits-heading">Artwork credits<span className="accent">.</span></h1><p>Artists and sources behind this space.</p></div></div><div className="settings-card"><h3>Flying dragon</h3><p>Artwork by <a href="https://openclipart.org/detail/315379/flying-dragon-silhouette-isolated">GDJ / Openclipart</a> · <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a></p></div></section>}
      <div className={view === 'settings' && (!backupsOpen || avatarPickerOpen || creditsOpen) ? 'backup-hidden' : undefined}>
      <WorkspaceGate ref={workout} identity={identity} view={view} exportHabits={() => habits.current?.exportData()}/>
      <HabitApp ref={habits} identity={identity} view={view} exportWorkout={() => workout.current?.exportData()}/>
      {view === 'settings' && backupsOpen && <div className="settings-card backup-card"><h3>Full app backup</h3><p>Includes workouts and habits. Restoring saves each app separately and may partially complete.</p><div className="settings-actions"><button className="outline-button" onClick={exportFull}><ArrowDownToLine size={16} aria-hidden="true"/> Export full backup</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore full backup<input type="file" accept="application/json,.json" onChange={event => { void restoreFull(event.target.files?.[0]); event.target.value = '' }}/></label></div></div>}
      </div>
      {view === 'settings' && !backupsOpen && !avatarPickerOpen && !creditsOpen && <div className="settings-card update-settings"><h3>App updates</h3><p role="status">{({ unavailable: 'Update checks are unavailable in this browser or build.', checking: 'Checking for updates…', current: 'No update found.', available: 'An update is ready to prepare.', activated: 'The update is ready to open.', error: 'Could not check for updates. Check your connection and try again.' })[update.status]}</p><button className="outline-button" disabled={update.status === 'unavailable' || update.status === 'checking'} onClick={() => void update.check()}>Check for updates</button></div>}
      {view === 'settings' && !backupsOpen && !avatarPickerOpen && !creditsOpen && <p className="app-version">The One Ring · v{appVersion}</p>}
    </div></main>
    <nav className="mobile-nav" aria-label="Main navigation"><button className={`mobile-fixed-nav ${view === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><Home size={19}/>Home</button><AppStrip view={view} navigate={navigate}/><button className={`mobile-fixed-nav ${view === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={19}/>Settings</button></nav>
  </div>
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
    {Array.from({ length: 7 }, (_, index) => <span className="app-strip-empty" role="img" aria-label={`App ring ${index + 3}, unassigned`} key={index}>{String(index + 3).padStart(2, '0')}</span>)}
  </div>
}
