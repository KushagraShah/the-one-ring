import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demoHabitData } from '../src/habits/demo'
import { eligible, localDate, parseHabits } from '../src/habits/model'
import { demoWorkoutBackup, seedDemoWorkouts } from '../src/workout/demo'
import { memoryStorage } from '../src/workout/online'
import { parseBackup } from '../src/workout/backup'
import { recentPerformances } from '../src/workout/sessionLogic'

const exercise = (name: string) => ({ name, equipment: 'Example machine', sets: '' })
const days = [
  { name: 'Push', subtitle: '', exercises: [exercise('Press'), exercise('Fly'), exercise('Raise')] },
  { name: 'Pull', subtitle: '', exercises: [exercise('Row'), exercise('Pulldown'), exercise('Curl')] },
  { name: 'Accessories', subtitle: '', exercises: [exercise('Crunch'), exercise('Extension'), exercise('Curl'), exercise('Treadmill')] },
  { name: 'Legs', subtitle: '', exercises: [exercise('Leg press'), exercise('Leg extension'), exercise('Squat')] },
]
const today = new Date(2026, 10, 8, 12)

test('demo workout history is valid, relative, and linked to exact library identities', () => {
  const backup = demoWorkoutBackup(days, today)
  assert.deepEqual(parseBackup(JSON.stringify(backup)), JSON.parse(JSON.stringify(backup)))
  assert.ok(backup.data.workouts.length >= 8)
  assert.ok(backup.data.workouts.every(workout => new Date(workout.date).getTime() < today.getTime()))
  const press = backup.library!.find(item => item.name === 'Press')!
  assert.ok(recentPerformances(backup.data.workouts, press).length >= 3)
  assert.ok(backup.data.workouts.some(workout => workout.exercises.some(item => item.cardio?.done)))
  const storage = memoryStorage(); seedDemoWorkouts(storage, days, today)
  assert.ok(storage.getItem('one-ring-demo-v1'))
  assert.equal(storage.getItem('one-ring-user-demo'), null)
})

test('demo habit history is valid, eligible, varied and not in the future', () => {
  const data = demoHabitData(today)
  assert.deepEqual(parseHabits(JSON.stringify(data)), data)
  assert.equal(data.habits.length, 3)
  assert.deepEqual(new Set(data.habits.map(habit => habit.schedules[0].kind)), new Set(['fixed', 'flexible']))
  assert.deepEqual(new Set(data.entries.map(entry => entry.outcome)), new Set(['done', 'partial', 'missed', 'skipped']))
  assert.ok(data.entries.every(entry => entry.date <= localDate(today) && eligible(data.habits.find(habit => habit.id === entry.habitId)!, entry.date)))
  assert.ok(data.entries.some(entry => entry.date === localDate(today)))
})
