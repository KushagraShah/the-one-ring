import { DetailView } from '../DetailView'
import { useEffect, useMemo, useRef, useState } from 'react'
import { catchUpDays, eligible, evaluateFlexibleWeek, flexibleWeekText, hasFlexibleWeek, indexEntries, localDate, outcomeLabel, shiftDate, versionAt, weekday, weekStart, type Habit, type HabitData } from './model'
import { calendarDayActivity, createCalendarActivityIndex, fixedScore, habitPeriodSummary, habitStreak, monthBounds, percent, type HabitPeriodSummary } from './insights'
import { InfoTip } from '../InfoTip'
import { HabitPanel } from './HabitPanel'

function ScoreSummary({ score }: { score: ReturnType<typeof fixedScore> }) {
  const scored = score.done + score.partial + score.missed
  return <div className="habit-summary-grid">
    <div><strong>{percent(score.performance)}</strong><span>Fixed performance</span><small>{scored} scored outcomes</small></div>
    <div><strong>{percent(score.coverage)}</strong><span>Fixed coverage</span><small>{scored} of {score.due} due logged</small></div>
  </div>
}

function FixedMetricHelp() {
  return <InfoTip label="About fixed performance and coverage">Performance: Done plus half of Partial, divided by scored outcomes. Coverage: scored outcomes / due opportunities. Both exclude Skip and archived habits. Unlogged is not Missed.</InfoTip>
}

type ReviewBounds = { from: string; to: string; outcomes: readonly ['partial', 'missed'] }
export type InsightsOrigin = {
  context: 'calendar' | 'catch-up' | 'week' | 'history' | 'evidence' | 'goal-week'
  view: 'overview' | 'weeks' | 'habits'; month: string; date: string; habitId?: string; week?: string
  selected: string; shown: number; panelScroll: number; windowScroll: number; review: ReviewBounds | null
}
export type InsightsReturn = { origin: InsightsOrigin; token: number }
const shortDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(day.slice(0, 4) !== localDate().slice(0, 4) ? { year: 'numeric' as const } : {}) })
const dateRange = (from: string, to: string) => `${shortDate(from)}–${shortDate(to)}`

function monthLabel(month: string): string {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(2000, number - 1, 1, 12)
  date.setFullYear(year)
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
function shiftMonth(month: string, amount: number): string {
  const [year, number] = month.split('-').map(Number)
  const index = year * 12 + number - 1 + amount
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`
}

type PeriodRow = HabitPeriodSummary & { habit: Habit }

function periodText(summary: PeriodRow, label: string): string {
  if (summary.kind === 'archived') return 'Archived · recorded history available'
  if (summary.kind === 'inactive') return `Not active in ${label}`
  if (summary.kind === 'mixed') return `Schedule changed in this period · ${summary.fixedOutcomes} fixed outcomes${summary.weeks.length ? ' · weekly goal context' : ''}`
  if (summary.kind === 'flexible') {
    const met = summary.weeks.filter(week => week.judgment === 'met').length
    const notMet = summary.weeks.filter(week => week.judgment === 'not-met').length
    const other = summary.weeks.length - met - notMet
    return `Weekly goal · ${met} met · ${notMet} not met · ${other} open or not comparable`
  }
  return summary.rankable && summary.fixedScore
    ? `${percent(summary.fixedScore.performance)} performance · ${percent(summary.fixedScore.coverage)} coverage · ${summary.fixedOutcomes} scored`
    : summary.label
}

export function Insights({ data, active, onDate, returnRequest }: { data: HabitData; active: boolean; onDate: (date: string, habitId: string | undefined, origin: InsightsOrigin) => void; returnRequest: InsightsReturn | null }) {
  const today = localDate()
  const [view, setView] = useState<'overview' | 'weeks' | 'habits'>('overview')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState('')
  const [shown, setShown] = useState(10)
  const [targetWeek, setTargetWeek] = useState('')
  const [review, setReview] = useState<ReviewBounds | null>(null)
  const historyScroll = useRef(0)
  const root = useRef<HTMLElement>(null)
  const historyHeading = useRef<HTMLHeadingElement>(null)
  const evidenceHeading = useRef<HTMLHeadingElement>(null)
  const catchUpHeading = useRef<HTMLHeadingElement>(null)
  const focusEvidencePending = useRef(false)
  const restoredToken = useRef<number | null>(null)
  const weekTargetRef = useRef<HTMLLIElement>(null)
  const focusWeekPending = useRef(false)
  const calendarScroll = useRef<HTMLDivElement>(null)
  const [calendarOverflows, setCalendarOverflows] = useState(false)
  const index = useMemo(() => indexEntries(data.entries), [data.entries])
  const habitsById = useMemo(() => new Map(data.habits.map(habit => [habit.id, habit])), [data.habits])
  const bounds = monthBounds(month, today)
  const calendarEnd = monthBounds(month, '9999-12-31').to
  const label = monthLabel(month)
  const selectedHabit = habitsById.get(selected)
  const monthScore = useMemo(() => fixedScore(data, bounds.from, bounds.to, index), [data, bounds.from, bounds.to, index])
  const flexEntries = useMemo(() => data.entries.filter(entry => {
    const habit = habitsById.get(entry.habitId)
    return entry.date >= bounds.from && entry.date <= bounds.to && habit && !habit.archived && eligible(habit, entry.date) && versionAt(habit.schedules, entry.date)?.kind === 'flexible'
  }), [data.entries, habitsById, bounds.from, bounds.to])
  const todayScore = useMemo(() => fixedScore(data, today, today, index), [data, today, index])
  const eightWeeks = useMemo(() => [...new Set(Array.from({ length: 8 }, (_, i) => shiftDate(weekStart(today), -7 * i)))].map(start => {
    const sunday = shiftDate(start, 6)
    const end = sunday < today ? sunday : today
    return {
      start, sunday, end,
      score: fixedScore(data, start, end, index),
      flexible: data.habits.filter(habit => !habit.archived && hasFlexibleWeek(habit, start, today)).map(habit => ({ habit, result: evaluateFlexibleWeek(habit, index.byHabitDate.get(habit.id) || new Map(), start, today) })),
    }
  }), [data, index, today])
  const summaries = useMemo(() => data.habits.map(habit => ({ habit, ...habitPeriodSummary(habit, index, bounds, today) })), [data.habits, index, bounds.from, bounds.to, today])
  const ordered = useMemo(() => [...summaries.filter(summary => summary.rankable).sort((a, b) => (a.fixedScore?.performance ?? 0) - (b.fixedScore?.performance ?? 0)), ...summaries.filter(summary => !summary.rankable)], [summaries])
  const selectedSummary = summaries.find(summary => summary.habit.id === selected)
  const patterns = useMemo(() => data.habits.map(habit => {
    const records = (index.byHabit.get(habit.id) || []).filter(entry => entry.date >= bounds.from && entry.date <= bounds.to)
    return { habit, partial: records.filter(entry => entry.outcome === 'partial').length, missed: records.filter(entry => entry.outcome === 'missed').length, total: records.filter(entry => entry.outcome !== 'skipped').length }
  }).filter(item => item.partial + item.missed >= 2).sort((a, b) => b.partial + b.missed - a.partial - a.missed), [data.habits, index, bounds.from, bounds.to])
  const catchUp = useMemo(() => catchUpDays(data, today), [data, today])
  const unmetWeeks = useMemo(() => summaries.flatMap(summary => summary.weeks.filter(week => week.judgment === 'not-met').map(week => ({ habit: summary.habit, week }))), [summaries])
  const calendarIndex = useMemo(() => createCalendarActivityIndex(data, index), [data, index])
  const calendarDays = useMemo(() => Array.from({ length: Number(calendarEnd.slice(8, 10)) }, (_, i) => {
    const day = shiftDate(bounds.from, i)
    return { day, ...calendarDayActivity(data, day, calendarIndex) }
  }), [data, calendarIndex, bounds.from, calendarEnd])
  const history = useMemo(() => selectedHabit ? [...(index.byHabit.get(selectedHabit.id) || []).map(entry => ({ ...entry, unlogged: false })), ...(data.unloggedNotes || []).filter(note => note.habitId === selectedHabit.id && !index.byHabitDate.get(selectedHabit.id)?.has(note.date)).map(note => ({ ...note, outcome: null, unlogged: true }))].filter(entry => entry.date <= today).sort((a, b) => b.date.localeCompare(a.date)) : [], [selectedHabit, index, today, data.unloggedNotes])
  const evidence = history.filter(entry => review && entry.date >= review.from && entry.date <= review.to && (entry.outcome === review.outcomes[0] || entry.outcome === review.outcomes[1]))
  const streak = useMemo(() => selectedHabit && !selectedHabit.archived ? habitStreak(selectedHabit, index.byHabit.get(selectedHabit.id) || [], today) : null, [selectedHabit, index, today])

  useEffect(() => {
    const element = calendarScroll.current
    if (!element) return
    const update = () => setCalendarOverflows(element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [active, month, view])

  useEffect(() => {
    if (!active || !selected || !targetWeek || !focusWeekPending.current) return
    const frame = requestAnimationFrame(() => { weekTargetRef.current?.scrollIntoView({ block: 'center' }); weekTargetRef.current?.focus({ preventScroll: true }); focusWeekPending.current = false })
    return () => cancelAnimationFrame(frame)
  }, [active, selected, targetWeek])

  useEffect(() => {
    if (!active || !selected || !focusEvidencePending.current) return
    const frame = requestAnimationFrame(() => { evidenceHeading.current?.scrollIntoView({ block: 'start' }); evidenceHeading.current?.focus({ preventScroll: true }); focusEvidencePending.current = false })
    return () => cancelAnimationFrame(frame)
  }, [active, selected, review])

  useEffect(() => {
    if (!active || !returnRequest || restoredToken.current === returnRequest.token) return
    const { origin, token } = returnRequest
    // Restore state before resolving a durable target, after native modal teardown has finished.
    setView(origin.view); setMonth(origin.month); setSelected(origin.selected); setReview(origin.review)
    if (origin.context === 'goal-week') setTargetWeek(origin.week || '')
    historyScroll.current = origin.panelScroll
    const nearest = [...history].sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(origin.date)) - Math.abs(Date.parse(b.date) - Date.parse(origin.date)) || b.date.localeCompare(a.date))[0]
    const targetDate = history.some(entry => entry.date === origin.date) ? origin.date : nearest?.date
    const targetIndex = history.findIndex(entry => entry.date === targetDate)
    const evidenceSurvives = origin.context === 'evidence' && evidence.some(entry => entry.date === targetDate)
    const requiredShown = evidenceSurvives ? origin.shown : Math.max(origin.shown, targetIndex + 1)
    if (shown < requiredShown) { setShown(requiredShown); return }
    setShown(requiredShown)
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (cancelled) return
      let target: HTMLElement | null | undefined
      if (origin.context === 'history' || origin.context === 'evidence') {
        const matchingEvidence = origin.context === 'evidence' && root.current?.querySelector<HTMLElement>(`[data-review-date="${targetDate}"]`)
        target = matchingEvidence || root.current?.querySelector<HTMLElement>(`[data-history-date="${targetDate}"]`) || historyHeading.current
      } else if (origin.context === 'goal-week') target = weekTargetRef.current
      else if (origin.context === 'week') target = root.current?.querySelector<HTMLElement>(`[data-insights-week="${origin.week}"] .detail-trigger`)
      else if (origin.context === 'catch-up') {
        const nearestDay = [...catchUp].sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(origin.date)) - Math.abs(Date.parse(b.date) - Date.parse(origin.date)) || b.date.localeCompare(a.date))[0]
        target = root.current?.querySelector<HTMLElement>(`[data-insights-catch-up="${nearestDay?.date}"]`) || catchUpHeading.current
      }
      else target = root.current?.querySelector<HTMLElement>(`[data-insights-${origin.context}="${origin.date}"]`)
      const body = root.current?.querySelector<HTMLElement>('.habit-modal-body')
      if (body) body.scrollTop = origin.panelScroll
      window.scrollTo(0, origin.windowScroll)
      target?.focus({ preventScroll: true })
      restoredToken.current = token
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [active, returnRequest, history, shown, catchUp])

  function navigate(date: string, context: InsightsOrigin['context'], habitId?: string, week?: string) {
    onDate(date, habitId, { context, view, month, date, habitId, week, selected, shown, panelScroll: historyScroll.current, windowScroll: window.scrollY, review })
  }

  function openHistory(habitId: string, monday = '', matchingReview: ReviewBounds | null = null) {
    focusWeekPending.current = Boolean(monday)
    focusEvidencePending.current = Boolean(matchingReview)
    setReview(matchingReview)
    setTargetWeek(monday)
    setSelected(habitId)
    setShown(10)
    historyScroll.current = 0
  }

  return <section ref={root} className="habit-insights" aria-label="Habit history and insights">
    <header className="habit-insights-header"><div><h2>History & insights</h2><p>Review activity, fixed metrics and weekly goals.</p></div></header>
    <nav className="habit-insight-nav" aria-label="Insights views">{(['overview', 'weeks', 'habits'] as const).map(item => <button type="button" key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item === 'overview' ? 'Overview' : item === 'weeks' ? 'Weeks' : 'By habit'}</button>)}</nav>
    <div className="habit-insights-period" hidden={view === 'weeks'}><div className="habit-month-navigation"><button type="button" aria-label="Previous month" disabled={month <= '0001-01'} onClick={() => setMonth(shiftMonth(month, -1))}>←</button><strong aria-live="polite">{label}</strong><button type="button" aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))}>→</button></div><label>Month <input type="month" min="0001-01" max={today.slice(0, 7)} value={month} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) && event.target.value >= '0001-01' && event.target.value <= today.slice(0, 7)) setMonth(event.target.value) }}/></label></div>

    <section hidden={view !== 'overview'} className="habit-card">
      <h3>Calendar · {label}</h3>
      <p className="habit-insight-note">Select a day to review it. <InfoTip label="About calendar activity">Fixed counts use eligible, non-archived habits. Other activity includes skips and archived or ineligible records; notes can exist without an outcome.</InfoTip></p>
      <div className="habit-calendar">
        {calendarOverflows && <p className="habit-insight-note habit-calendar-scroll-cue">Swipe or scroll for all seven days →</p>}
        <div className="habit-calendar-scroll" ref={calendarScroll} tabIndex={calendarOverflows ? 0 : undefined} role="region" aria-label={`${label} calendar`} style={{ maxWidth: '100%', overflowX: 'auto' }}>
          <div className="habit-calendar-grid" style={{ minWidth: 332, gridTemplateColumns: 'repeat(7, minmax(44px, 1fr))' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <strong key={day}>{day}</strong>)}
            {Array.from({ length: weekday(bounds.from) }, (_, i) => <span key={`blank-${i}`}/>)}
            {calendarDays.map(({ day, fixedScore: score, recordedOutcomes: recorded, otherRecordedOutcomes: other, noteCount: notes, noteOnlyCount: noteOnly }) => day > today
              ? <button type="button" key={day} disabled aria-label={`${day}, future date`}><span>{Number(day.slice(8, 10))}</span><small>—</small></button>
              : <button type="button" key={day} data-insights-calendar={day} onClick={() => navigate(day, 'calendar')} aria-current={day === today ? 'date' : undefined} aria-label={`${day}, ${score.done + score.partial + score.missed} of ${score.due} fixed logged, ${recorded} outcomes recorded, ${other} other recorded outcomes, ${notes} notes including ${noteOnly} without an outcome`}>
                <span>{Number(day.slice(8, 10))}</span>
                <small>{score.due ? `${score.done + score.partial + score.missed}/${score.due} fixed` : recorded ? `${recorded} log` : '—'}</small>
                <span className="habit-calendar-markers" aria-hidden="true">{other > 0 && <small className="habit-calendar-activity">●</small>}{notes > 0 && <small className="habit-calendar-note">✎</small>}</span>
              </button>)}
          </div>
        </div>
        <small>Fixed = logged / due · log = recorded outcomes · ● other activity, including skips · ✎ saved note</small>
      </div>
    </section>

    <section hidden={view !== 'overview'} className="habit-card">
      <h3>Fixed overview · {label} <FixedMetricHelp/></h3>
      <ScoreSummary score={monthScore}/>
      <p className="habit-insight-note">Fixed habits only · {bounds.from}–{bounds.to}. Archived habits are excluded because their archive date is not recorded. Performance excludes skips and unlogged days; coverage excludes skips.</p>
      <div className="habit-counts"><span>{monthScore.done} done</span><span>{monthScore.partial} partial</span><span>{monthScore.missed} missed</span><span>{monthScore.skipped} skipped</span></div>
    </section>
    <section hidden={view !== 'overview'} className="habit-card">
      <h3>Flexible activity · {label}</h3>
      <p className="habit-insight-note">Eligible, non-archived flexible outcomes dated {bounds.from}–{bounds.to}. These are activity counts. Weekly goals stay whole across month boundaries; see Weeks for results.</p>
      <div className="habit-counts">{(['done', 'partial', 'missed', 'skipped'] as const).map(outcome => <span key={outcome}>{flexEntries.filter(entry => entry.outcome === outcome).length} {outcome}</span>)}</div>
    </section>
    <section hidden={view !== 'overview'} className="habit-card">
      <h3>Today · {today} · fixed habits <FixedMetricHelp/></h3>
      <ScoreSummary score={todayScore}/>
      <p className="habit-insight-note">Actual today, independent of the selected month. Eligible, non-archived fixed habits only.</p>
    </section>
    <section hidden={view !== 'overview'} className="habit-card">
      <h3>Needs review</h3>
      <h4 ref={catchUpHeading} tabIndex={-1}>Unlogged · previous 7 days <InfoTip label="About unlogged review">Fixed opportunities anchored to today. Unlogged is not Missed; archived habits are excluded.</InfoTip></h4>
      {catchUp.length ? <div className="habit-rank">{catchUp.map(day => <button type="button" key={day.date} data-insights-catch-up={day.date} onClick={() => navigate(day.date, 'catch-up')}><span>{shortDate(day.date)}</span><span>{day.count} unlogged <b aria-hidden="true">›</b></span></button>)}</div> : <p className="habit-insight-note">No recent unlogged fixed opportunities.</p>}
      <h4>Recorded Partial and Missed · {label}</h4>
      <p className="habit-insight-note">Two or more recorded outcomes <InfoTip label="About recorded review">Includes archived and ineligible history. Skips and empty days are excluded. Open a row for this month's matching evidence and all history.</InfoTip></p>
      {patterns.length ? <div className="habit-rank">{patterns.map(({ habit, partial, missed }) => <button type="button" key={habit.id} onClick={() => openHistory(habit.id, '', { ...bounds, outcomes: ['partial', 'missed'] })}><span>{habit.icon || '◈'} {habit.title}{habit.archived ? ' · Archived' : ''}</span><span>{partial} partial · {missed} missed <b aria-hidden="true">›</b></span></button>)}</div> : <p className="habit-insight-note">No habits have two or more recorded Partial or Missed outcomes in {label}.</p>}
      <h4>Weekly goals not met <InfoTip label="About unmet weekly review">Completed comparable whole weeks touching {label}, including dates outside the month. Archived habits are excluded. No daily misses are inferred.</InfoTip></h4>
      {unmetWeeks.length ? <div className="habit-rank">{unmetWeeks.map(({ habit, week }) => <button type="button" key={`${habit.id}-${week.monday}`} onClick={() => openHistory(habit.id, week.monday)} aria-label={`${habit.title}, ${week.monday}–${week.sunday}, ${flexibleWeekText(week)}`}><span>{habit.title}</span><span>{dateRange(week.monday, week.sunday)} · {flexibleWeekText(week)} <b aria-hidden="true">›</b></span></button>)}</div> : <p className="habit-insight-note">No completed comparable weeks not met.</p>}
    </section>

    <section hidden={view !== 'weeks'} className="habit-card">
      <h3>Past eight weeks · through {today}</h3>
      <p className="habit-insight-note">Oldest to newest · current week through today. <FixedMetricHelp/></p>
      <div className="habit-chart-legend"><span><i className="habit-legend-performance"/> Performance</span><span><i className="habit-legend-coverage"/> Coverage</span><span>Scale 0–100%</span></div>
      <div className="habit-week-chart" aria-label="Weekly fixed habit trends">{[...eightWeeks].reverse().map(({ start, sunday, score }) => <div key={start} className="habit-week-chart-column" role="img" aria-label={`${start}–${sunday}${start === weekStart(today) ? `, through today ${today}` : ''}: fixed performance ${score.performance === null ? 'no data' : percent(score.performance)}, fixed coverage ${score.coverage === null ? 'no data' : percent(score.coverage)}`}>
        <div className="habit-bars" aria-hidden="true">{([['performance', score.performance], ['coverage', score.coverage]] as const).map(([metric, value]) => <div className="habit-bar-track" key={metric}>{value === null ? <span className="habit-bar-na">—</span> : value === 0 ? <span className={`habit-bar-zero habit-bar-${metric}`}>0</span> : <span style={{ height: `${value * 100}%` }} className={`habit-bar-fill habit-bar-${metric}`}/>}</div>)}</div><small>{start.slice(5)}{start === weekStart(today) && <span className="habit-chart-cutoff">Through today {shortDate(today)}</span>}</small>
      </div>)}</div>
      <p className="habit-insight-note">0 = zero · — = no data. Exact values below, oldest first.</p>
      <div className="habit-trend">{[...eightWeeks].reverse().map(({ start, sunday, end, score, flexible }) => <div key={start} data-insights-week={start}><DetailView title={`${start}–${sunday}${start === weekStart(today) ? ` · through today ${today}` : ''}`} trigger={<><span>{start}–{sunday}{start === weekStart(today) && <small>Through today {today}</small>}</span><span>{percent(score.performance)} fixed performance · {percent(score.coverage)} fixed coverage</span></>} closeOnAction>
        <h3>Fixed habits · {start}–{end}</h3><ScoreSummary score={score}/><p className="habit-insight-note">Scored outcomes exclude Skip. Due excludes intentional skips. Archived habits are excluded.</p>
        <button type="button" className="text-button" onClick={() => navigate(end, 'week', undefined, start)}>Review {end}</button>
        <h3>Flexible goals · {start}–{sunday}{start === weekStart(today) && ` · through today ${today}`}</h3>
        <p className="habit-insight-note">Done = 1 point; Partial = ½; Missed and Skip = 0. Skip applies to one day.{start === weekStart(today) && ' Current-week results are not final.'}</p>
        {flexible.length ? <ul>{flexible.map(({ habit, result }) => <li key={habit.id}><strong>{habit.title}</strong>: {flexibleWeekText(result)}{result.phase === 'in-progress' && result.primaryExclusion ? ' · Week in progress' : ''}</li>)}</ul> : <p>No relevant flexible goals in this week.</p>}
      </DetailView></div>)}</div>
    </section>

    <section hidden={view !== 'habits'} className="habit-card">
      <h3>By habit · {label}</h3>
      <p className="habit-insight-note">Unchanged fixed schedules with at least three scored outcomes are listed from lower performance. All other rows follow in your chosen order. Flexible results use whole weeks touching this month. Select a habit for period details and all recorded history.</p>
      {ordered.length === 0 ? <p>No habits yet.</p> : <div className="habit-period-table">{ordered.map(summary => <button type="button" key={summary.habit.id} onClick={() => openHistory(summary.habit.id)} aria-pressed={selected === summary.habit.id}><strong>{summary.habit.icon || '◈'} {summary.habit.title}</strong><span className="habit-period-kind">{summary.kind}{summary.rankable ? ' · ranked' : summary.kind === 'fixed' ? ' · not ranked (fewer than 3 scored)' : ''}</span>{summary.kind === 'fixed' && summary.fixedScore ? <span className="habit-period-metrics"><span className="habit-period-performance">Performance <strong>{percent(summary.fixedScore.performance)}</strong></span><span className="habit-period-coverage">Coverage <strong>{percent(summary.fixedScore.coverage)}</strong></span><span>Scored <strong>{summary.fixedOutcomes}</strong></span></span> : <span>{periodText(summary, label)}</span>}<span className="habit-row-chevron" aria-hidden="true">›</span></button>)}</div>}
    </section>

    {active && selectedHabit && <HabitPanel title={`${selectedHabit.icon || '◈'} ${selectedHabit.title}`} scrollPosition={historyScroll} onClose={() => setSelected('')}>
      {review && <section className="habit-review-evidence"><h3 ref={evidenceHeading} tabIndex={-1}>Recorded Partial and Missed · {monthLabel(review.from.slice(0, 7))}</h3><p className="habit-insight-note">{evidence.length} matching outcomes · {dateRange(review.from, review.to)}. Includes archived and ineligible records.</p>{evidence.length ? <div className="habit-history-list">{evidence.map(entry => <button type="button" key={entry.date} data-review-date={entry.date} onClick={() => navigate(entry.date, 'evidence', selectedHabit.id)}><span>{shortDate(entry.date)}</span><span className="habit-history-result"><strong>{outcomeLabel(selectedHabit, entry.date, entry.outcome!)}</strong><small>{entry.outcome === 'partial' ? 'Partial' : 'Missed'}{entry.note ? ` · ${entry.note}` : ''}</small></span></button>)}</div> : <p>No matching outcomes remain. All history is available below.</p>}</section>}
      {selectedSummary && <section className="habit-history-period"><h3>{label}</h3><p>{periodText(selectedSummary, label)}</p>
        {(selectedSummary.kind === 'fixed' || selectedSummary.kind === 'mixed') && selectedSummary.fixedScore && <><ScoreSummary score={selectedSummary.fixedScore}/><p className="habit-insight-note">Fixed schedule dates in {bounds.from}–{bounds.to} only. <FixedMetricHelp/></p></>}
        {selectedSummary.weeks.length > 0 && <><h4>Whole weeks touching {label}</h4><p className="habit-insight-note">Full weekly goals and activity include dates outside this month. Done = 1 point; Partial = ½. Skip applies to one day, including in past weeks.</p><ul>{selectedSummary.weeks.map(result => {
          const correctionDate = Array.from({ length: 7 }, (_, i) => shiftDate(result.monday, 6 - i)).find(day => day <= today && !selectedHabit.archived && eligible(selectedHabit, day))
          return <li key={result.monday} ref={targetWeek === result.monday ? weekTargetRef : undefined} tabIndex={targetWeek === result.monday ? -1 : undefined} className={targetWeek === result.monday ? 'habit-target-week' : undefined}>{result.monday}–{result.sunday}: {flexibleWeekText(result)}{result.phase === 'in-progress' && result.primaryExclusion ? ' · Week in progress' : ''}{targetWeek === result.monday && correctionDate && <button type="button" className="text-button" onClick={() => navigate(correctionDate, 'goal-week', selectedHabit.id, result.monday)}>Review {correctionDate}</button>}</li>
        })}</ul></>}
      </section>}
      {selectedHabit.archived ? <p>Archived · current streak unavailable because the archive date was not recorded.</p> : streak && <>
        <h4>Current streaks · as of {today}</h4>
        <p>Success: <strong>{streak.success} {streak.unit}</strong> · engagement: <strong>{streak.engagement} {streak.unit}</strong></p>
        <p className="habit-insight-note">{streak.unit === 'weeks' ? 'Completed comparable flexible weeks only. Success counts Met weeks; engagement counts weeks with positive points. Paused and partial-active weeks are passed over without adding or breaking the streak. Schedule changes and non-flexible weeks stop it. Skip affects one day and adds zero points. A completed zero-point week breaks both streaks, even when empty or skip-only; it does not create daily Missed outcomes. The current open week does not add to either streak.' : 'Scheduled fixed days only. Partial preserves engagement; skips are paused days and do not add to or break a streak. A past unlogged due day breaks it. Unlogged today is pending.'}</p>
      </>}
      <h4 ref={historyHeading} tabIndex={-1}>Recorded outcomes & notes · all dates through {today}</h4>
      {history.length === 0 ? <p>No recorded outcomes or notes.</p> : <><div className="habit-history-list">{history.slice(0, shown).map(entry => <button type="button" key={entry.date} data-history-date={entry.date} onClick={() => navigate(entry.date, 'history', selectedHabit.id)}><span>{entry.date}</span><span className="habit-history-result"><strong>{entry.outcome ? outcomeLabel(selectedHabit, entry.date, entry.outcome) : 'Unlogged note'}</strong>{entry.note && <small>{entry.note}</small>}</span></button>)}</div>{shown < history.length && <button type="button" className="outline-button" onClick={() => setShown(shown + 10)}>Show more</button>}</>}
    </HabitPanel>}
  </section>
}
