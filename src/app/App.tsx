import { useRef, useState } from 'react'
import { ArrowUpRight, ChevronRight, Dumbbell, Home, ListChecks, MoreHorizontal, Settings2 } from 'lucide-react'
import { version as appVersion } from '../../package.json'
import { HabitApp } from '../habits/HabitApp'
import { WorkspaceGate, type WorkoutHandle } from '../workout/WorkoutApp'

type Identity = { id: string; email: string; demo: boolean }
type View = 'home' | 'workout' | 'habits' | 'settings'

export function App({ identity, signOut }: { identity: Identity; signOut: () => void }) {
  const [view, setView] = useState<View>('home')
  const [theme, setTheme] = useState(() => window.localStorage.getItem('one-ring-theme') || 'lime')
  const workout = useRef<WorkoutHandle>(null)
  const navigate = (next: View) => {
    if (next === view) { if (next === 'workout') workout.current?.open(); return }
    const apply = () => { if (next === 'workout') workout.current?.open(); setView(next) }
    if (view === 'workout' && workout.current) workout.current.leave(apply)
    else apply()
  }
  const exit = () => {
    if (workout.current && !workout.current.canSignOut()) { window.alert('Wait for the current workout save to finish before signing out.'); return }
    signOut()
  }
  return <div className="app-shell" data-theme={theme}>
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><span /></span><span>the one ring<small>YOUR SPACE TO GROW</small></span></div><div className="sidebar-label">YOUR SPACE</div><button className={`side-link ${view === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><Home size={18}/> Home</button><button className={`side-link ${view === 'workout' ? 'active' : ''}`} onClick={() => navigate('workout')}><Dumbbell size={18}/> Workouts</button><button className={`side-link ${view === 'habits' ? 'active' : ''}`} onClick={() => navigate('habits')}><ListChecks size={18}/> Habits</button><div className="sidebar-bottom"><button className="profile" onClick={() => navigate('settings')}><span className="avatar">D</span><span><strong>{identity.demo ? 'Demo user' : identity.email}</strong><small>{identity.demo ? 'Demo mode' : 'Online'}</small></span><MoreHorizontal size={19}/></button></div></aside>
    <main className="main"><header className="topbar"><div className="mobile-brand"><span className="brand-mark"><span/></span> the one ring</div><div className="breadcrumb">YOUR SPACE <ChevronRight size={13}/> <span>{view === 'home' ? 'Overview' : view === 'settings' ? 'Settings' : view === 'habits' ? 'Habit Tracker' : 'Workout Tracker'}</span></div><button className="top-profile" onClick={() => navigate('settings')}><span className="status-dot"/> {identity.demo ? 'Demo mode' : 'Online'} <span className="avatar small">{identity.demo ? 'D' : identity.email[0].toUpperCase()}</span></button></header>
    <div className="content">
      {view === 'home' && <><div className="greeting"><div><h1>Your apps<span className="accent">.</span></h1><p>Choose an app.</p></div></div><div className="dashboard-grid"><div className="workout-card"><div className="workout-card-body"><div className="eyebrow">WORKOUT TRACKER</div><h3>Workouts<span className="accent">.</span></h3><p>Build routines and keep a record of your workouts.</p><button className="primary" onClick={() => navigate('workout')}>Go to workouts <ArrowUpRight size={17}/></button></div></div><div className="coming-card"><div className="coming-icon"><ListChecks size={20}/></div><span className="soon">PREVIEW</span><h3>Habit tracker.</h3><p>Habit tracking is not implemented yet.</p><button className="outline-button" onClick={() => navigate('habits')}>Open preview</button></div></div></>}
      {view === 'habits' && <HabitApp/>}
      {view === 'settings' && <><div className="page-heading"><div><h1>Settings<span className="accent">.</span></h1></div></div><div className="settings-card"><div className="settings-row"><span className="avatar">D</span><div><strong>{identity.demo ? 'Demo user' : identity.email}</strong><small>{identity.demo ? 'Temporary demo' : 'Online account'}</small></div></div><div className="detail-divider"/><h3>Appearance</h3><p>Choose an accent color for your space.</p><div className="theme-options">{[['lime', 'Lime'], ['blue', 'Blue'], ['violet', 'Violet'], ['coral', 'Coral']].map(([value, label]) => <button key={value} className={`theme-choice ${theme === value ? 'selected' : ''}`} onClick={() => { setTheme(value); window.localStorage.setItem('one-ring-theme', value) }}><span className={`theme-swatch ${value}`}/>{label}</button>)}</div><div className="demo-warning"><p>{identity.demo ? 'Demo data is temporary and resets on refresh.' : 'Workout data is saved to Supabase. An internet connection is required.'}</p></div><button className="outline-button signout" onClick={exit}>{identity.demo ? 'Exit demo' : 'Sign out'}</button></div></>}
      <WorkspaceGate ref={workout} identity={identity} view={view}/>
      {view === 'settings' && <p className="app-version">The One Ring · v{appVersion}</p>}
    </div></main>
    <nav className="mobile-nav" aria-label="Main navigation"><button className={view === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={19}/>Home</button><button className={view === 'workout' ? 'active' : ''} onClick={() => navigate('workout')}><Dumbbell size={19}/>Workouts</button><button className={view === 'habits' ? 'active' : ''} onClick={() => navigate('habits')}><ListChecks size={19}/>Habits</button><button className={view === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings2 size={19}/>Settings</button></nav>
  </div>
}
