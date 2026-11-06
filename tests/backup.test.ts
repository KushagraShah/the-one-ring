import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBackup } from '../src/backup'

const valid = { version: 1, data: { completed: [], workouts: [], session: null }, warmupItems: [], days: [{ name: 'Push', subtitle: '', exercises: [] }], library: [] }

test('valid older backup is accepted', () => { assert.deepEqual(parseBackup(JSON.stringify(valid)), valid) })
test('invalid nested workout data is rejected', () => { assert.throws(() => parseBackup(JSON.stringify({ ...valid, data: { ...valid.data, workouts: [{ day: 'Push', date: 'bad', exercises: [] }] } }))) })
test('invalid exercise links are rejected', () => { assert.throws(() => parseBackup(JSON.stringify({ ...valid, library: [{ name: 'Press', equipment: '', sets: '', video: 'javascript:alert(1)' }] }))) })
test('malformed JSON is rejected', () => { assert.throws(() => parseBackup('{')) })
