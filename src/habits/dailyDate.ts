import { localDate, shiftDate } from './model'

/** Daily check-in rolls over at 1am; calendar dates elsewhere remain unchanged. */
export function automaticDailyDate(now = new Date()): string {
  const today = localDate(now)
  return now.getHours() < 1 ? shiftDate(today, -1) : today
}

export function nextDailyBoundary(now = new Date()): number {
  const next = new Date(now)
  if (now.getHours() < 1) next.setHours(1, 0, 0, 0)
  else { next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0) }
  return next.getTime() - now.getTime()
}
