import { test } from 'node:test'
import assert from 'node:assert/strict'
import { automaticDailyDate, dailyStripDays, nextDailyBoundary } from '../src/habits/dailyDate'

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

test('recent selections share a stable seven-day strip ending today', () => {
  const expected = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']
  for (const selected of ['2026-11-26', '2026-11-25', '2026-11-20']) {
    assert.deepEqual(dailyStripDays(selected, '2026-11-26'), expected)
  }
})

test('oldest catch-up and older selections end their own strip', () => {
  assert.deepEqual(dailyStripDays('2026-11-19', '2026-11-26'), [
    '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
  ])
  assert.deepEqual(dailyStripDays('2024-03-01', '2026-11-26'), [
    '2024-02-24', '2024-02-25', '2024-02-26', '2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01',
  ])
})

test('strip crosses the local year boundary and caps future selection', () => {
  const expected = ['2024-12-27', '2024-12-28', '2024-12-29', '2024-12-30', '2024-12-31', '2025-01-01', '2025-01-02']
  assert.deepEqual(dailyStripDays('2025-01-02', '2025-01-02'), expected)
  assert.deepEqual(dailyStripDays('2025-02-01', '2025-01-02'), expected)
})
