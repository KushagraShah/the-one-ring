import { localDate, shiftDate } from './model'

/** Keep recent dates stable, and keep older selected dates inside their own window. */
export function dailyStripDays(selected: string, today: string): string[] {
  const capped = selected > today ? today : selected
  const end = capped >= shiftDate(today, -6) ? today : capped
  return Array.from({ length: 7 }, (_, index) => shiftDate(end, index - 6))
}

/** Daily check-in follows the local calendar day. */
export function automaticDailyDate(now = new Date()): string {
  return localDate(now)
}

export function nextDailyBoundary(now = new Date()): number {
  const next = new Date(now)
  next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0)
  return next.getTime() - now.getTime()
}
