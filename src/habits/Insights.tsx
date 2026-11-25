import { DetailView } from '../DetailView'
import { useMemo, useRef, useState } from 'react'
import { eligible, indexEntries, localDate, outcomeLabel, shiftDate, versionAt, weekStart, type HabitData } from './model'
import { fixedScore, flexibleWeek, hasFlexibleWeek, habitStreak, monthBounds, percent } from './insights'
import { InfoTip } from '../InfoTip'
import { HabitPanel } from './HabitPanel'

function ScoreSummary({ score }: { score: ReturnType<typeof fixedScore> }) {
  return <div className="habit-summary-grid"><div><strong>{percent(score.performance)}</strong><span>Fixed score</span><small>{score.done + score.partial + score.missed} scored</small></div><div><strong>{percent(score.coverage)}</strong><span>Coverage</span><small>{score.done + score.partial + score.missed} of {score.due} logged</small></div></div>
}

export function Insights({ data, active, onDate }: { data: HabitData; active: boolean; onDate: (date: string, habitId?: string) => void }) {
  const today = localDate()
  const [view, setView] = useState<'overview' | 'weeks' | 'habits'>('overview')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState('')
  const [shown, setShown] = useState(10)
  const historyScroll = useRef(0)
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
  const history = useMemo(() => {
    if (!selectedHabit) return []
    const days = new Map<string, { date: string; outcome: (typeof data.entries)[number]['outcome'] | null; notes: string[] }>()
    for (const entry of index.byHabit.get(selectedHabit.id) || []) {
      if (entry.date <= today) days.set(entry.date, { date: entry.date, outcome: entry.outcome, notes: entry.note ? [entry.note] : [] })
    }
    for (const note of data.unloggedNotes || []) {
      if (note.habitId !== selectedHabit.id || note.date > today) continue
      const day = days.get(note.date) || { date: note.date, outcome: null, notes: [] }
      if (note.note && !day.notes.includes(note.note)) day.notes.push(note.note)
      days.set(note.date, day)
    }
    return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [selectedHabit, index, data.unloggedNotes, today])
  const streak = useMemo(() => selectedHabit ? habitStreak(selectedHabit, index.byHabit.get(selectedHabit.id) || [], today) : null, [selectedHabit, index, today])
  const streaks = useMemo(() => data.habits.filter(habit => !habit.archived).map(habit => ({ habit, streak: habitStreak(habit, index.byHabit.get(habit.id) || [], today) })).filter(item => item.streak.success > 0 || item.streak.engagement > 0), [data.habits, index, today])
  const previousMonth = shiftDate(bounds.from, -1).slice(0, 7)
  const previousBounds = monthBounds(previousMonth, today)
  const previousScore = useMemo(() => fixedScore(data, previousBounds.from, previousBounds.to, index), [data, previousBounds.from, previousBounds.to, index])
  const scored = (score: ReturnType<typeof fixedScore>) => score.done + score.partial + score.missed
  const recurring = useMemo(() => data.habits.filter(habit => !habit.archived).map(habit => {
    const habitData = { ...data, habits: [habit] }
    return {
      habit,
      current: fixedScore(habitData, bounds.from, bounds.to, index),
      previous: fixedScore(habitData, previousBounds.from, previousBounds.to, index),
    }
  }).filter(({ current, previous }) =>
    current.done + current.partial + current.missed >= 3 &&
    previous.done + previous.partial + previous.missed >= 3 &&
    current.performance !== null && current.performance < 0.5 &&
    previous.performance !== null && previous.performance < 0.5
  ), [data, index, bounds.from, bounds.to, previousBounds.from, previousBounds.to])
  const openHabit = (id: string) => { setSelected(id); setShown(10); historyScroll.current = 0 }
  return <section className="habit-insights" aria-label="Habit history and insights">
    <header className="habit-insights-header"><div><h2>History & insights</h2><p>Review what you recorded, without counting empty days as missed.</p></div></header>
    <nav className="habit-insight-nav" aria-label="Insights views">{(['overview', 'weeks', 'habits'] as const).map(item => <button key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item === 'overview' ? 'Overview' : item === 'weeks' ? 'Weeks' : 'By habit'}</button>)}</nav>
    <section hidden={view !== 'overview'} className="habit-card"><h3>Recurring areas to revisit · fixed habits</h3><p className="habit-insight-note">Recorded fixed performance below 50% in both periods, with at least three scored outcomes in each. Skips and unlogged days are not scored; flexible targets are separate. The current month is through today, and low coverage limits what these results show.</p>{recurring.length === 0 ? <p>No recurring pattern found with enough recorded fixed outcomes in both periods.</p> : <div className="habit-rank">{recurring.map(({ habit, current, previous }) => <button key={habit.id} onClick={() => openHabit(habit.id)}><span>{habit.icon || '◈'} {habit.title}</span><span>{previousMonth}: {percent(previous.performance)} · {scored(previous)} of {previous.due} scored<br/>{month}: {percent(current.performance)} · {scored(current)} of {current.due} scored</span></button>)}</div>}</section>
    <section hidden={view !== 'overview'} className="habit-card"><h3>Today · fixed habits <InfoTip label="About performance and coverage">Performance uses recorded Done, Partial and Missed outcomes; Partial counts as half. Coverage counts recorded outcomes out of fixed habits due; intentional skips are paused days and excluded. Unlogged is not Missed.</InfoTip></h3><ScoreSummary score={todayScore}/><p className="habit-insight-note">Performance excludes skips and unlogged days. Coverage excludes skipped days.</p>{heavy && <p className="habit-workload">Higher load today: {scheduledToday} eligible habits versus an average of {average.toFixed(1)} logs per day over the past week. This is a rough comparison, not a judgment.</p>}</section>
    <section hidden={view !== 'overview'} className="habit-card"><div className="habit-section-heading"><h3>Monthly overview</h3><label>Month <input type="month" max={today.slice(0, 7)} value={month} onChange={event => { if (event.target.value && event.target.value <= today.slice(0, 7)) setMonth(event.target.value) }}/></label></div><ScoreSummary score={monthScore}/><p className="habit-insight-note">Fixed habits only; the current month includes days through today. Archived habits are excluded because their archive date is not recorded. Flexible activity appears separately below.</p><div className="habit-counts"><span>{monthScore.done} done</span><span>{monthScore.partial} partial</span><span>{monthScore.missed} missed</span><span>{monthScore.skipped} skipped</span></div></section>
    <section hidden={view !== 'overview'} className="habit-card"><h3>At a glance</h3><p><strong>Fixed performance:</strong> {month} {percent(monthScore.performance)} ({scored(monthScore)} scored; {percent(monthScore.coverage)} coverage) · {previousMonth} {percent(previousScore.performance)} ({scored(previousScore)} scored; {percent(previousScore.coverage)} coverage).</p><p className="habit-insight-note">Compare recorded outcomes, not unlogged days. The current month is through today; differing coverage and partial months limit comparisons.</p><h4>Lowest recorded fixed performance · {month}</h4>{ranked.filter(({ score }) => scored(score) >= 3).length === 0 ? <p>Not enough data: at least three scored fixed outcomes per habit are needed.</p> : <div className="habit-rank">{ranked.filter(({ score }) => scored(score) >= 3).slice(0, 3).map(({ habit, score }) => <button key={habit.id} onClick={() => openHabit(habit.id)}><span>{habit.icon || '◈'} {habit.title}</span><span>{percent(score.performance)} · {scored(score)} scored of {score.due} due</span></button>)}</div>}<h4>Current streaks</h4>{streaks.length === 0 ? <p>No current success or engagement streaks to show.</p> : <div className="habit-rank">{streaks.map(({ habit, streak: current }) => <button key={habit.id} onClick={() => openHabit(habit.id)}><span>{habit.icon || '◈'} {habit.title}</span><span>{current.success} success · {current.engagement} engagement {current.unit}</span></button>)}</div>}<p className="habit-insight-note">Fixed streaks count scheduled days; flexible streaks count eligible completed weeks. Open a habit for details.</p></section>
    <section hidden={view !== 'overview'} className="habit-card"><h3>Flexible activity this month</h3><p className="habit-insight-note">Recorded outcomes by calendar date, not a monthly target. Weekly targets are shown by week to avoid splitting weeks across months.</p><div className="habit-counts">{(['done', 'partial', 'missed', 'skipped'] as const).map(outcome => <span key={outcome}>{flexEntries.filter(entry => entry.outcome === outcome).length} {outcome}</span>)}</div><DetailView className="habit-month-days" title={`Browse days in ${month}`} closeOnAction><div className="habit-month-grid">{Array.from({ length: Number(bounds.to.slice(8, 10)) }, (_, i) => shiftDate(bounds.from, i)).map(day => { const count = (index.byDate.get(day)?.length || 0); return <button key={day} onClick={() => onDate(day)} aria-label={`${day}, ${count} recorded outcomes`}>{Number(day.slice(8, 10))}<small>{count} logged</small></button> })}</div></DetailView></section>
    <section hidden={view !== 'weeks'} className="habit-card"><h3>Past eight weeks</h3><p className="habit-insight-note">Fixed-habit performance and coverage; the current week is through today. Archived habits are excluded.</p><div className="habit-week-chart" aria-label="Weekly fixed habit trends">{[...eightWeeks].reverse().map(start => { const end = [shiftDate(start, 6), today].sort()[0]; const score = fixedScore(data, start, end, index); return <div key={start} className="habit-week-chart-column" role="img" aria-label={`Week of ${start}: performance ${score.performance === null ? 'no data' : percent(score.performance)}, coverage ${score.coverage === null ? 'no data' : percent(score.coverage)}`}><div className="habit-bars" aria-hidden="true">{([['performance', score.performance], ['coverage', score.coverage]] as const).map(([metric, value]) => <div className="habit-bar-track" key={metric}>{value === null ? <span className="habit-bar-na">—</span> : value === 0 ? <span className={`habit-bar-zero habit-bar-${metric}`}>0</span> : <span style={{ height: `${value * 100}%` }} className={`habit-bar-fill habit-bar-${metric}`}/>}</div>)}</div><small>{start.slice(5)}</small></div> })}</div><p className="habit-insight-note">Violet: performance · grey: coverage. 0 is zero; — means no data. Exact values below.</p><div className="habit-trend">{eightWeeks.map(start => { const end = [shiftDate(start, 6), today].sort()[0]; const score = fixedScore(data, start, end, index); const flexible = data.habits.filter(habit => hasFlexibleWeek(habit, start, today)).map(habit => ({ habit, result: flexibleWeek(habit, index.byHabit.get(habit.id) || [], start, today) })); return <DetailView key={start} title={`Week of ${start}`} trigger={<><span>Week of {start}</span><span>{percent(score.performance)} performance · {percent(score.coverage)} coverage</span></>} closeOnAction><button className="text-button" onClick={() => onDate(end)}>Review {end}</button>{flexible.length > 0 && <ul>{flexible.map(({ habit, result }) => <li key={habit.id}>{habit.title}: {result.points} points{result.target === null ? result.reason === 'Week in progress' ? ` / ${versionAt(habit.schedules, end)?.target || 0} · ${result.points >= (versionAt(habit.schedules, end)?.target || Infinity) ? 'goal met so far' : 'in progress'} (not yet judged)` : ` · not judged: ${result.reason}` : ` / ${result.target} · ${result.points >= result.target ? 'target met' : 'target not met'}`}</li>)}</ul>}</DetailView> })}</div></section>
    <section hidden={view !== 'habits'} className="habit-card"><h3>By habit</h3><p className="habit-insight-note">Habits with at least three scored fixed outcomes this month are listed from lower performance; others follow in your chosen order.</p>{ranked.length === 0 ? <p>No habits yet.</p> : <div className="habit-rank">{ranked.map(({ habit, score }) => <button key={habit.id} onClick={() => openHabit(habit.id)} aria-pressed={selected === habit.id}><span>{habit.icon || '◈'} {habit.title}{habit.archived ? ' · archived' : ''}</span><span>{score.done + score.partial + score.missed >= 3 ? `${percent(score.performance)} · ${score.done + score.partial + score.missed} scored` : 'Not enough fixed data'}</span></button>)}</div>}</section>
    {active && selectedHabit && streak && <HabitPanel title={`${selectedHabit.icon || '◈'} ${selectedHabit.title}`} scrollPosition={historyScroll} onClose={() => setSelected('')}>{selectedHabit.archived ? <p>Streak unavailable: the archive date was not recorded.</p> : <><p>Current success: <strong>{streak.success} {streak.unit}</strong> · engagement: <strong>{streak.engagement} {streak.unit}</strong></p><p className="habit-insight-note">{streak.unit === 'weeks' ? 'Completed flexible weeks only. Paused, skipped, partial-active or changed-schedule weeks are excluded.' : 'Scheduled fixed days only. Partial preserves engagement; skips are paused days and do not add to or break a streak. A past unlogged due day breaks it. Unlogged today is pending.'}</p></>}<h4>History</h4><p className="habit-insight-note">Choose a day to review or correct it. Unlogged notes are not outcomes.</p>{history.length === 0 ? <p>No recorded outcomes or notes.</p> : <><div className="habit-history-list">{history.slice(0, shown).map(entry => <button key={entry.date} onClick={() => onDate(entry.date, selectedHabit.id)}><span>{entry.date}</span><span className="habit-history-result"><strong>{entry.outcome ? outcomeLabel(selectedHabit, entry.date, entry.outcome) : 'Unlogged'}</strong>{entry.notes.map((note, i) => <small key={i}>{note}</small>)}</span></button>)}</div>{shown < history.length && <button className="outline-button" onClick={() => setShown(shown + 10)}>Show more</button>}</>}</HabitPanel>}
  </section>
}
