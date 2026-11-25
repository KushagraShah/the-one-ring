import { test } from 'node:test'
import assert from 'node:assert/strict'
import { automaticDailyDate, nextDailyBoundary } from '../src/habits/dailyDate'

test('daily selection changes at local midnight across month and year boundaries', () => {
  for (const [input, expected] of [
    ['2025-01-01T00:00:00', '2025-01-01'],
    ['2024-03-01T00:59:59', '2024-03-01'],
    ['2024-03-01T01:00:00', '2024-03-01'],
    ['2024-02-29T23:59:59', '2024-02-29'],
  ]) assert.equal(automaticDailyDate(new Date(input)), expected)
  assert.equal(nextDailyBoundary(new Date('2025-01-01T00:59:59')), 23 * 3600000 + 1 * 1000)
  assert.equal(nextDailyBoundary(new Date('2024-12-31T23:59:59')), 1000)
})
