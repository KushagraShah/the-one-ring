import { localDate } from './model'

/** Daily check-in follows the local calendar day. */
export function automaticDailyDate(now = new Date()): string {
  return localDate(now)
}

export function nextDailyBoundary(now = new Date()): number {
  const next = new Date(now)
  next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0)
  return next.getTime() - now.getTime()
}
