import { eligible, localDate, shiftDate, weekday, type Entry, type Habit, type HabitData, type Outcome } from './model'

/** Fictional, relative-date examples for the temporary demo only. */
export function demoHabitData(now = new Date()): HabitData {
  const today = localDate(now)
  const start = shiftDate(today, -70)
  const definitions = [
    { id: 'd0000000-0000-4000-8000-000000000001', title: 'Read a little', description: 'Example: make time for a book.', kind: 'fixed' as const, weekdays: [0, 1, 2, 3, 4, 5, 6], target: 1, done: 'Read for 20 minutes', partial: 'Read for a few minutes' },
    { id: 'd0000000-0000-4000-8000-000000000002', title: 'Go for a walk', description: 'Example: a flexible weekly goal.', kind: 'flexible' as const, weekdays: [0, 1, 2, 3, 4, 5, 6], target: 3, done: 'Walk for 30 minutes', partial: 'Take a shorter walk' },
    { id: 'd0000000-0000-4000-8000-000000000003', title: 'Stretch', description: 'Example: a few scheduled days each week.', kind: 'fixed' as const, weekdays: [0, 2, 4], target: 1, done: 'Stretch for 10 minutes', partial: 'Stretch briefly' },
  ]
  const habits: Habit[] = definitions.map(item => ({ id: item.id, title: item.title, description: item.description, start, end: null, archived: false, schedules: [{ effective: start, kind: item.kind, weekdays: item.weekdays, target: item.target }], criteria: [{ effective: start, done: item.done, partial: item.partial, missed: 'Did not do it' }], pauses: [] }))
  const entries: Entry[] = []
  for (let offset = 70; offset >= 0; offset--) {
    const date = shiftDate(today, -offset)
    for (const [index, habit] of habits.entries()) {
      if (!eligible(habit, date)) continue
      if (offset === 0 && index !== 0) continue
      if (index === 1 && ![0, 2, 5].includes(weekday(date))) continue
      if (offset > 0 && (offset + index * 3) % 13 === 0) continue
      const outcome: Outcome = offset === 0 ? 'done' : (offset + index) % 17 === 0 ? 'skipped' : (offset + index) % 11 === 0 ? 'missed' : (offset + index) % 5 === 0 ? 'partial' : 'done'
      entries.push({ habitId: habit.id, date, outcome, note: offset === 1 && index === 0 ? 'An example note.' : '' })
    }
  }
  return { version: 1, habits, entries }
}
