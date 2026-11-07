import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WorkoutSession } from '../src/workout/WorkoutSession'
import { RoutineBuilder } from '../src/workout/RoutineBuilder'
import { ExerciseLibrary } from '../src/workout/ExerciseLibrary'

const exercise = { id: 'one', name: 'Press', equipment: 'Machine', sets: '', note: '- Seat 4\n- Grip' }
const other = { id: 'two', name: 'Row', equipment: '', sets: '' }
const noop = () => {}

test('focused session exposes navigation and explains today-only extras', () => {
  const html = renderToStaticMarkup(React.createElement(WorkoutSession, {
    session: { day: 'Push', exercises: [exercise, other], entries: {}, skipped: [], warmups: [] }, workouts: [], library: [exercise, other], rotations: [],
    onChange: noop, onFinish: noop, onBack: noop, onCancel: noop, onDirty: noop, onSetup: noop,
  }))
  assert.match(html, /Previous/)
  assert.match(html, /Skip/)
  assert.match(html, /Next/)
  assert.doesNotMatch(html, /Move earlier|Move later/)
  assert.match(html, /Your saved routine will not change/)
  assert.match(html, /Cancel workout/)
  assert.match(html, /Save log/)
  assert.match(html, /Replace with a different exercise today/)
  assert.match(html, /This replaces the current exercise only for this workout/)
  assert.doesNotMatch(html, /focus-picker/)
})

test('last exercise offers a return to the first', () => {
  const html = renderToStaticMarkup(React.createElement(WorkoutSession, {
    session: { day: 'Push', exercises: [exercise, other], entries: {}, skipped: ['Press'], warmups: [] }, workouts: [], library: [exercise, other], rotations: [],
    onChange: noop, onFinish: noop, onBack: noop, onCancel: noop, onDirty: noop, onSetup: noop,
  }))
  assert.match(html, /Go to first/)
})

test('cycle variants have a separate choice from ordinary replacements', () => {
  const group = { id: 'group', name: 'Arms', primaryDay: 'Push', complementDay: '', options: ['one', 'two'] }
  const html = renderToStaticMarkup(React.createElement(WorkoutSession, {
    session: { day: 'Push', exercises: [{ ...exercise, rotationGroupId: 'group' }], entries: {}, skipped: [], warmups: [] }, workouts: [], library: [exercise, other], rotations: [group],
    onChange: noop, onFinish: noop, onBack: noop, onCancel: noop, onDirty: noop, onSetup: noop,
  }))
  assert.match(html, /Exercise cycle · Arms/)
  assert.match(html, /Completing it counts toward this cycle/)
  assert.match(html, /replacement will not count toward an exercise cycle/)
  assert.match(html, /Row/)
})

test('routine editor exposes a draft and explicit save', () => {
  const html = renderToStaticMarkup(React.createElement(RoutineBuilder, {
    days: [{ name: 'Push', subtitle: '', exercises: [exercise] }], library: [exercise, other], rotations: [], routines: [{ id: 'r', name: 'Routine' }], activeRoutine: 'r', hasSession: false, onDirty: noop, onSave: () => true, onBack: noop, onLibrary: noop, onNew: noop, onSwitch: noop, onCancelWorkout: noop,
  }))
  assert.match(html, /Save changes/)
  assert.match(html, /Make exercise cycle/)
  assert.match(html, /Move Press up/)
  assert.match(html, /Move Press down/)
  assert.match(html, /New routine/)
})

test('exercise library exposes search, tags and reversible archive', () => {
  const html = renderToStaticMarkup(React.createElement(ExerciseLibrary, { exercises: [{ ...exercise, tags: ['Chest'] }], onSave: noop, onBack: noop }))
  assert.match(html, /Exercise, equipment or tag/)
  assert.match(html, /Chest/)
  assert.match(html, /Show archived/)
  assert.match(html, /Archive/)
})
