import { useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpRight, ChevronRight, Dumbbell, Home, ListChecks, MoreHorizontal, RotateCcw, Settings2 } from 'lucide-react'
import { version as appVersion } from '../../package.json'
import { HabitApp, type HabitHandle } from '../habits/HabitApp'
import { parseHabits } from '../habits/model'
import { WorkspaceGate, type WorkoutHandle } from '../workout/WorkoutApp'

type Identity = { id: string; email: string; demo: boolean }
type View = 'home' | 'workout' | 'habits' | 'settings'

export function App({ identity, signOut }: { identity: Identity; signOut: () => void }) {
  const [view, setView] = useState<View>('home')
  const [theme, setTheme] = useState(() => window.localStorage.getItem('one-ring-theme') || 'lime')
  const workout = useRef<WorkoutHandle>(null)
  const habits = useRef<HabitHandle>(null)
  const navigate = (next: View) => {
    if (next === view) { if (next === 'workout') workout.current?.open(); return }
    const apply = () => { if (next === 'workout') workout.current?.open(); setView(next) }
    if (view === 'workout' && workout.current) workout.current.leave(apply)
    else if (view === 'habits' && habits.current) habits.current.leave(apply)
    else apply()
  }
  const exit = () => {
    if ((workout.current && !workout.current.canSignOut()) || (habits.current && !habits.current.canSignOut())) { window.alert('Finish your edits and wait for saves before signing out.'); return }
    signOut()
  }
  const exportFull = () => {
    const w = workout.current; const h = habits.current; const data = h?.snapshot()
    if (!w || !h || !data || !w.canSignOut() || !h.canSignOut()) { window.alert('Both apps must be loaded and saved before exporting a full backup.'); return }
    const exportedAt = new Date().toISOString()
    const file = { scope: 'full', format: 1, exportedAt, workouts: w.snapshot(), habits: data }
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `one-ring-full-${exportedAt.replace(/[:.]/g, '-')}.json`; link.click(); URL.revokeObjectURL(url)
  }
  const restoreFull = async (file?: File) => {
    if (!file) return
    const w = workout.current; const h = habits.current
    if (!w || !h || !h.snapshot() || !w.canSignOut() || !h.canSignOut()) { window.alert('Both apps must be loaded and saved before restoring.'); return }
    let workoutData: ReturnType<WorkoutHandle['validateBackup']>; let habitData: ReturnType<typeof parseHabits>
    try {
      if (file.size > 20_000_000) throw new Error('Too large')
      const value = JSON.parse(await file.text())
      if (value.scope !== 'full' || value.format !== 1) throw new Error('Wrong scope')
      workoutData = w.validateBackup(value.workouts); habitData = parseHabits(JSON.stringify(value.habits))
    } catch { window.alert('Invalid full backup. Neither app was changed.'); return }
    if (!window.confirm('Replace BOTH workout and habit data? Export a full backup first. Each app saves separately: a failure may leave only one restored. Keep this page open and follow any save errors.')) return
    try { w.replace(workoutData); h.replace(habitData); window.alert('Restore started. The two apps save separately; wait for both saving indicators and address any errors before leaving.') }
    catch { window.alert('Restore could not finish. One app may have changed. Keep this page open, inspect both apps and export their data before retrying.') }
  }
  return <div className="app-shell" data-theme={theme}>
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><span /></span><span>the one ring<small>YOUR SPACE TO GROW</small></span></div><div className="sidebar-label">YOUR SPACE</div><button className={`side-link ${view === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><Home size={18}/> Home</button><button className={`side-link ${view === 'workout' ? 'active' : ''}`} onClick={() => navigate('workout')}><Dumbbell size={18}/> Workouts</button><button className={`side-link ${view === 'habits' ? 'active' : ''}`} onClick={() => navigate('habits')}><ListChecks size={18}/> Habits</button><div className="sidebar-bottom"><button className="profile" onClick={() => navigate('settings')}><span className="avatar">{identity.demo ? 'D' : identity.email[0].toUpperCase()}</span><span><strong>{identity.demo ? 'Demo user' : identity.email}</strong><small>{identity.demo ? 'Demo mode' : 'Account'}</small></span><MoreHorizontal size={19}/></button></div></aside>
    <main className="main"><header className="topbar"><div className="mobile-brand"><span className="brand-mark"><span/></span> the one ring</div><div className="breadcrumb">YOUR SPACE <ChevronRight size={13}/> <span>{view === 'home' ? 'Overview' : view === 'settings' ? 'Settings' : view === 'habits' ? 'Habit Tracker' : 'Workout Tracker'}</span></div><button className="top-profile" onClick={() => navigate('settings')}>{identity.demo ? 'Demo mode' : 'Account'} <span className="avatar small">{identity.demo ? 'D' : identity.email[0].toUpperCase()}</span></button></header>
    <div className="content">
      {view === 'home' && <><div className="greeting"><div><h1>Your apps<span className="accent">.</span></h1><p>Choose an app.</p></div></div><div className="dashboard-grid"><div className="workout-card"><div className="workout-card-body"><div className="eyebrow">WORKOUT TRACKER</div><h3>Workouts<span className="accent">.</span></h3><p>Build routines and keep a record of your workouts.</p><button className="primary" onClick={() => navigate('workout')}>Go to workouts <ArrowUpRight size={17}/></button></div></div><div className="workout-card"><div className="workout-card-body"><div className="eyebrow">HABIT TRACKER</div><h3>Habits<span className="accent">.</span></h3><p>Track and reflect on your habits.</p><button className="primary" onClick={() => navigate('habits')}>Go to habits <ArrowUpRight size={17}/></button></div></div></div></>}
      {view === 'settings' && <><div className="page-heading"><div><h1>Settings<span className="accent">.</span></h1></div></div><div className="settings-card"><div className="settings-row"><span className="avatar">{identity.demo ? 'D' : identity.email[0].toUpperCase()}</span><div><strong>{identity.demo ? 'Demo user' : identity.email}</strong><small>{identity.demo ? 'Temporary demo' : 'Account'}</small></div></div><div className="detail-divider"/><h3>Appearance</h3><p>Choose an accent color for your space.</p><div className="theme-options">{[['lime', 'Lime'], ['blue', 'Blue'], ['violet', 'Violet'], ['coral', 'Coral']].map(([value, label]) => <button key={value} className={`theme-choice ${theme === value ? 'selected' : ''}`} onClick={() => { setTheme(value); window.localStorage.setItem('one-ring-theme', value) }}><span className={`theme-swatch ${value}`}/>{label}</button>)}</div><div className="demo-warning"><p>{identity.demo ? 'Demo data is temporary and resets on refresh.' : 'Your account data is saved to Supabase. An internet connection is required.'}</p></div><button className="outline-button signout" onClick={exit}>{identity.demo ? 'Exit demo' : 'Sign out'}</button></div></>}
      <WorkspaceGate ref={workout} identity={identity} view={view} exportHabits={() => habits.current?.exportData()}/>
      <HabitApp ref={habits} identity={identity} view={view} exportWorkout={() => workout.current?.exportData()}/>
      {view === 'settings' && <div className="settings-card backup-card"><h3>Full app backup</h3><p>Includes workouts and habits. Restoring saves each app separately and may partially complete.</p><div className="settings-actions"><button className="outline-button" onClick={exportFull}><ArrowDownToLine size={16} aria-hidden="true"/> Export full backup</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore full backup<input type="file" accept="application/json,.json" onChange={event => { void restoreFull(event.target.files?.[0]); event.target.value = '' }}/></label></div></div>}
      {view === 'settings' && <p className="app-version">The One Ring · v{appVersion}</p>}
    </div></main>
    <nav className="mobile-nav" aria-label="Main navigation"><button className={view === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={19}/>Home</button><button className={view === 'workout' ? 'active' : ''} onClick={() => navigate('workout')}><Dumbbell size={19}/>Workouts</button><button className={view === 'habits' ? 'active' : ''} onClick={() => navigate('habits')}><ListChecks size={19}/>Habits</button><button className={view === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings2 size={19}/>Settings</button></nav>
  </div>
}
