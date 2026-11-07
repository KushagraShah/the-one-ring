/** A small write-ahead journal for the related localStorage keys of a workout. */
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Write = [string, string]

function decode(value: string): Write[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || !parsed.every(item => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string')) throw new Error('Invalid local workout recovery journal.')
  return parsed as Write[]
}

/** Complete an interrupted commit before reading any of its keys. */
export function recoverLocalTransaction(storage: StorageLike, journalKey: string): void {
  const journal = storage.getItem(journalKey)
  if (journal === null) return
  for (const [key, value] of decode(journal)) storage.setItem(key, value)
  storage.removeItem(journalKey)
}

/** Once the journal is written, recovery must complete the entire commit. */
export function commitLocalTransaction(storage: StorageLike, journalKey: string, writes: Write[]): void {
  if (storage.getItem(journalKey) !== null) throw new Error('A previous workout save needs recovery. Reload the app before continuing.')
  storage.setItem(journalKey, JSON.stringify(writes))
  for (const [key, value] of writes) storage.setItem(key, value)
  storage.removeItem(journalKey)
}
