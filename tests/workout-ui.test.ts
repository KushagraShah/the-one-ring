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
  assert.match(html, /replacements and extras do not change your routine/)
  assert.match(html, /Cancel workout/)
  assert.match(html, /Save log/)
  assert.match(html, /Replace for this workout/)
  assert.match(html, /Add exercise/)
  assert.doesNotMatch(html, /focus-picker/)
})

test('last exercise offers a return to the first', () => {
  const html = renderToStaticMarkup(React.createElement(WorkoutSession, {
    session: { day: 'Push', exercises: [exercise, other], entries: {}, skipped: ['Press'], warmups: [] }, workouts: [], library: [exercise, other], rotations: [],
    onChange: noop, onFinish: noop, onBack: noop, onCancel: noop, onDirty: noop, onSetup: noop,
  }))
  assert.match(html, /Next exercise/)
})

test('cycle variants have a separate choice from ordinary replacements', () => {
  const group = { id: 'group', name: 'Arms', primaryDay: 'Push', complementDay: '', options: ['one', 'two'] }
  const html = renderToStaticMarkup(React.createElement(WorkoutSession, {
    session: { day: 'Push', exercises: [{ ...exercise, rotationGroupId: 'group' }], entries: {}, skipped: [], warmups: [] }, workouts: [], library: [exercise, other], rotations: [group],
    onChange: noop, onFinish: noop, onBack: noop, onCancel: noop, onDirty: noop, onSetup: noop,
  }))
  assert.match(html, /Exercise cycle · Arms/)
  assert.match(html, /Completing it counts toward this cycle/)
  assert.match(html, /Replace for this workout/)
  assert.match(html, /aria-haspopup="dialog"/)
})

test('routine editor exposes a draft and explicit save', () => {
  const html = renderToStaticMarkup(React.createElement(RoutineBuilder, {
    days: [{ name: 'Push', subtitle: '', exercises: [exercise] }], library: [exercise, other], rotations: [], routines: [{ id: 'r', name: 'Routine' }], activeRoutine: 'r', hasSession: false, onDirty: noop, onSave: () => true, onLibrary: noop, onNew: noop, onSwitch: noop,
  }))
  assert.match(html, /Save changes/)
  assert.match(html, /Actions/)
  assert.match(html, /New routine/)
})

test('exercise library exposes search, tags and reversible archive', () => {
  const html = renderToStaticMarkup(React.createElement(ExerciseLibrary, { exercises: [{ ...exercise, tags: ['Chest'] }], workouts: [], onSave: noop, onDirty: noop }))
  assert.match(html, /Exercise, equipment or tag/)
  assert.match(html, /Chest/)
  assert.match(html, /Show archived/)
  assert.match(html, /Archiving/)
})
