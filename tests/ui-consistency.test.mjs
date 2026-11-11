import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? sources(join(directory, entry.name)) : /\.(tsx?|jsx?)$/.test(entry.name) ? [join(directory, entry.name)] : []))).flat()
}

test('app source does not reintroduce native selects, disclosure widgets or JavaScript popups', async () => {
  for (const file of await sources('src')) {
    const content = await readFile(file, 'utf8')
    assert.doesNotMatch(content, /<(?:select|details|summary|datalist)\b/, `${file} contains a native select or disclosure`)
    assert.doesNotMatch(content, /\bwindow\.(?:alert|confirm|prompt)\s*\(/, `${file} contains a native JavaScript popup`)
  }
})
