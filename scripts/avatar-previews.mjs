// The sprite remains the app's single source of truth. Generate standalone,
// browseable copies without requiring a browser to load external SVG symbols.
import { readFile, writeFile } from 'node:fs/promises'

const base = new URL('../src/assets/avatars/', import.meta.url)
const source = await readFile(new URL('portraits.svg', base), 'utf8')
const defs = source.match(/  <defs>[\s\S]*?  <\/defs>/)?.[0]
const symbols = [...source.matchAll(/  <symbol id="([^"]+)" viewBox="0 0 100 100"([^>]*)>(.*?)<\/symbol>/g)]
if (!defs || symbols.length !== 27) throw new Error('Unexpected portrait sprite structure')

for (const [, id, attributes, content] of symbols) {
  const output = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n${defs}\n  <g${attributes}>${content}</g>\n</svg>\n`
  const target = new URL(`${id}.svg`, base)
  if (process.argv.includes('--check')) {
    if (await readFile(target, 'utf8') !== output) throw new Error(`Out-of-date avatar: ${id}.svg`)
  } else {
    await writeFile(target, output)
  }
}
