import { localDate } from './model'

/** Automatic selection follows the local calendar day. */
export function automaticDailyDate(now = new Date()): string { return localDate(now) }

export function nextDailyBoundary(now = new Date()): number {
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return next.getTime() - now.getTime()
}
