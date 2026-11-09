import { useMemo, useState } from 'react'
import { eligible, indexEntries, localDate, shiftDate, versionAt, weekStart, type HabitData } from './model'
import { fixedScore, flexibleWeek, habitStreak, monthBounds, percent } from './insights'
import { InfoTip } from '../InfoTip'
import { Sheet } from '../workout/Sheet'

function ScoreSummary({ score }: { score: ReturnType<typeof fixedScore> }) {
  return <div className="habit-summary-grid"><div><strong>{percent(score.performance)}</strong><span>Performance</span><small>{score.done + score.partial + score.missed} scored</small></div><div><strong>{percent(score.coverage)}</strong><span>Coverage</span><small>{score.done + score.partial + score.missed + score.skipped} of {score.due} logged</small></div></div>
}

export function Insights({ data, onDate }: { data: HabitData; onDate: (date: string, habitId?: string) => void }) {
  const today = localDate()
  const [view, setView] = useState<'overview' | 'weeks' | 'habits'>('overview')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState('')
  const [shown, setShown] = useState(10)
  const index = useMemo(() => indexEntries(data.entries), [data.entries])
  const habitsById = useMemo(() => new Map(data.habits.map(habit => [habit.id, habit])), [data.habits])
  const bounds = monthBounds(month, today)
  const selectedHabit = data.habits.find(habit => habit.id === selected)
  const monthScore = useMemo(() => fixedScore(data, bounds.from, bounds.to, index), [data, bounds.from, bounds.to, index])
  const flexEntries = useMemo(() => data.entries.filter(entry => {
    const habit = habitsById.get(entry.habitId)
    return entry.date >= bounds.from && entry.date <= bounds.to && habit && !habit.archived && eligible(habit, entry.date) && versionAt(habit.schedules, entry.date)?.kind === 'flexible'
  }), [data.entries, habitsById, bounds.from, bounds.to])
  const todayScore = useMemo(() => fixedScore(data, today, today, index), [data, today, index])
  const eightWeeks = Array.from({ length: 8 }, (_, i) => shiftDate(weekStart(today), -7 * i))
  const scheduledToday = data.habits.filter(habit => !habit.archived && eligible(habit, today)).length
  const priorDays = Array.from({ length: 7 }, (_, i) => shiftDate(today, -i - 1))
  const counts = priorDays.map(day => (index.byDate.get(day)?.length || 0))
  const activeDays = counts.filter(count => count > 0).length
  const average = counts.reduce((sum, count) => sum + count, 0) / 7
  const heavy = activeDays >= 3 && scheduledToday >= 4 && scheduledToday >= average * 2
  const ranked = useMemo(() => data.habits.map(habit => ({ habit, score: fixedScore({ habits: [habit], entries: index.byHabit.get(habit.id) || [], version: 1 }, bounds.from, bounds.to, index) })).sort((a, b) => {
    const aEnough = a.score.done + a.score.partial + a.score.missed >= 3
    const bEnough = b.score.done + b.score.partial + b.score.missed >= 3
    if (aEnough !== bEnough) return aEnough ? -1 : 1
    return aEnough && bEnough ? (a.score.performance ?? 0) - (b.score.performance ?? 0) : 0
  }), [data.habits, index, bounds.from, bounds.to])
  const history = useMemo(() => selectedHabit ? (index.byHabit.get(selectedHabit.id) || []).filter(entry => entry.date <= today).sort((a, b) => b.date.localeCompare(a.date)) : [], [selectedHabit, index, today])
  const streak = useMemo(() => selectedHabit ? habitStreak(selectedHabit, index.byHabit.get(selectedHabit.id) || [], today) : null, [selectedHabit, index, today])
  return <section className="habit-insights" aria-label="Habit history and insights">
    <header className="habit-insights-header"><div><h2>History & insights</h2><p>Review what you recorded, without counting empty days as missed.</p></div></header>
    <nav className="habit-insight-nav" aria-label="Insights views">{(['overview', 'weeks', 'habits'] as const).map(item => <button key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item === 'overview' ? 'Overview' : item === 'weeks' ? 'Weeks' : 'By habit'}</button>)}</nav>
    <section hidden={view !== 'overview'} className="habit-card"><h3>Today · fixed habits <InfoTip label="About performance and coverage">Performance uses recorded Done, Partial and Missed outcomes; Partial counts as half. Coverage counts recorded outcomes, including Skipped, out of fixed habits due. Unlogged is not Missed.</InfoTip></h3><ScoreSummary score={todayScore}/><p className="habit-insight-note">Performance excludes skips and unlogged days. Coverage includes skips.</p>{heavy && <p className="habit-workload">Higher load today: {scheduledToday} eligible habits versus an average of {average.toFixed(1)} logs per day over the past week. This is a rough comparison, not a judgment.</p>}</section>
    <section hidden={view !== 'overview'} className="habit-card"><div className="habit-section-heading"><h3>Monthly overview</h3><label>Month <input type="month" max={today.slice(0, 7)} value={month} onChange={event => { if (event.target.value && event.target.value <= today.slice(0, 7)) setMonth(event.target.value) }}/></label></div><ScoreSummary score={monthScore}/><p className="habit-insight-note">Fixed habits only; the current month includes days through today. Archived habits are excluded because their archive date is not recorded. Flexible activity appears separately below.</p><div className="habit-counts"><span>{monthScore.done} done</span><span>{monthScore.partial} partial</span><span>{monthScore.missed} missed</span><span>{monthScore.skipped} skipped</span></div></section>
    <section hidden={view !== 'overview'} className="habit-card"><h3>Flexible activity this month</h3><p className="habit-insight-note">Recorded outcomes by calendar date, not a monthly target. Weekly targets are shown by week to avoid splitting weeks across months.</p><div className="habit-counts">{(['done', 'partial', 'missed', 'skipped'] as const).map(outcome => <span key={outcome}>{flexEntries.filter(entry => entry.outcome === outcome).length} {outcome}</span>)}</div><details className="habit-month-days"><summary>Browse days in {month}</summary><div className="habit-month-grid">{Array.from({ length: Number(bounds.to.slice(8, 10)) }, (_, i) => shiftDate(bounds.from, i)).map(day => { const count = (index.byDate.get(day)?.length || 0); return <button key={day} onClick={() => onDate(day)} aria-label={`${day}, ${count} recorded outcomes`}>{Number(day.slice(8, 10))}<small>{count} logged</small></button> })}</div></details></section>
    <section hidden={view !== 'weeks'} className="habit-card"><h3>Past eight weeks</h3><p className="habit-insight-note">Fixed-habit performance and coverage; the current week is through today. Archived habits are excluded.</p><div className="habit-week-chart" aria-label="Weekly fixed habit trends">{[...eightWeeks].reverse().map(start => { const end = [shiftDate(start, 6), today].sort()[0]; const score = fixedScore(data, start, end, index); return <div key={start} className="habit-week-chart-column" title={`${start}: ${percent(score.performance)} performance, ${percent(score.coverage)} coverage`}><div className="habit-bars"><span style={{ height: `${(score.performance ?? 0) * 100}%` }} className="habit-bar-performance"/><span style={{ height: `${(score.coverage ?? 0) * 100}%` }} className="habit-bar-coverage"/></div><small>{start.slice(5)}</small></div> })}</div><p className="habit-insight-note">Violet: performance · grey: coverage. Empty bars may mean no data; exact values below.</p><div className="habit-trend">{eightWeeks.map(start => { const end = [shiftDate(start, 6), today].sort()[0]; const score = fixedScore(data, start, end, index); const flexible = data.habits.filter(habit => !habit.archived && versionAt(habit.schedules, start)?.kind === 'flexible').map(habit => ({ habit, result: flexibleWeek(habit, index.byHabit.get(habit.id) || [], start, today) })); return <details key={start}><summary><span>Week of {start}</span><span>{percent(score.performance)} performance · {percent(score.coverage)} coverage</span></summary><button className="text-button" onClick={() => onDate(end)}>Review {end}</button>{flexible.length > 0 && <ul>{flexible.map(({ habit, result }) => <li key={habit.id}>{habit.title}: {result.points} points{result.target === null ? ` · ${result.reason}` : ` / ${result.target} · ${result.points >= result.target ? 'target met' : 'target not met'}`}</li>)}</ul>}</details> })}</div></section>
    <section hidden={view !== 'habits'} className="habit-card"><h3>By habit</h3><p className="habit-insight-note">Habits with at least three scored fixed outcomes this month are listed from lower performance; others follow in your chosen order.</p>{ranked.length === 0 ? <p>No habits yet.</p> : <div className="habit-rank">{ranked.map(({ habit, score }) => <button key={habit.id} onClick={() => { setSelected(habit.id); setShown(10) }} aria-pressed={selected === habit.id}><span>{habit.icon || '◈'} {habit.title}{habit.archived ? ' · archived' : ''}</span><span>{score.done + score.partial + score.missed >= 3 ? `${percent(score.performance)} · ${score.done + score.partial + score.missed} scored` : 'Not enough fixed data'}</span></button>)}</div>}</section>
    {selectedHabit && streak && <Sheet title={`${selectedHabit.icon || '◈'} ${selectedHabit.title}`} onClose={() => setSelected('')}>{selectedHabit.archived ? <p>Streak unavailable: the archive date was not recorded.</p> : <><p>Current success: <strong>{streak.success} {streak.unit}</strong> · engagement: <strong>{streak.engagement} {streak.unit}</strong></p><p className="habit-insight-note">{streak.unit === 'weeks' ? 'Completed flexible weeks only. Paused, skipped, partial-active or changed-schedule weeks are excluded.' : 'Scheduled fixed days only. Partial and Skip preserve engagement; a past unlogged due day breaks it. Unlogged today is pending.'}</p></>}<h4>Recorded outcomes</h4>{history.length === 0 ? <p>No recorded outcomes.</p> : <><div className="habit-history-list">{history.slice(0, shown).map(entry => <button key={entry.date} onClick={() => onDate(entry.date, selectedHabit.id)}><span>{entry.date}</span><span>{entry.outcome[0].toUpperCase() + entry.outcome.slice(1)}{entry.note ? ' · Note' : ''}</span></button>)}</div>{shown < history.length && <button className="outline-button" onClick={() => setShown(shown + 10)}>Show more</button>}</>}</Sheet>}
  </section>
}
