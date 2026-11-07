import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commitLocalTransaction, recoverLocalTransaction } from '../src/workout/localTransaction'

function storage() {
  const values = new Map<string, string>()
  let failure: string | null = null
  return {
    values,
    failOn(key: string | null) { failure = key },
    getItem(key: string) { return values.get(key) ?? null },
    setItem(key: string, value: string) { if (key === failure) throw new Error('Storage unavailable'); values.set(key, value) },
    removeItem(key: string) { if (key === failure) throw new Error('Storage unavailable'); values.delete(key) },
  }
}

test('commits workout and cycle together and removes its journal', () => {
  const store = storage()
  commitLocalTransaction(store, 'journal', [['workout', 'finished'], ['cycle', 'advanced']])
  assert.equal(store.getItem('workout'), 'finished')
  assert.equal(store.getItem('cycle'), 'advanced')
  assert.equal(store.getItem('journal'), null)
})

test('an interrupted workout commit is completed before loading the data', () => {
  const store = storage()
  store.setItem('workout', 'in progress')
  store.setItem('cycle', 'before')
  store.failOn('cycle')
  assert.throws(() => commitLocalTransaction(store, 'journal', [['workout', 'finished'], ['cycle', 'advanced']]))
  assert.throws(() => commitLocalTransaction(store, 'journal', [['workout', 'other']]))
  store.failOn(null)
  recoverLocalTransaction(store, 'journal')
  assert.equal(store.getItem('workout'), 'finished')
  assert.equal(store.getItem('cycle'), 'advanced')
  assert.equal(store.getItem('journal'), null)
})

test('invalid recovery data is retained rather than silently discarded', () => {
  const store = storage()
  store.setItem('journal', 'invalid')
  assert.throws(() => recoverLocalTransaction(store, 'journal'))
  assert.equal(store.getItem('journal'), 'invalid')
})
