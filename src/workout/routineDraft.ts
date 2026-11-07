/** Carry cycle progress across saved day renames and drop removed days. */
export function mapCycleDays(items: string[], names: Record<string, string | null>): string[] {
  return items.map(name => Object.prototype.hasOwnProperty.call(names, name) ? names[name] : name).filter((name): name is string => Boolean(name))
}

export function moveItem<T>(items: T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function describeCycleDay(selected: boolean, linked: boolean, existingName?: string): string {
  if (linked) return selected ? 'Already uses this cycle' : 'Will remove this cycle slot'
  if (!selected) return 'Not included'
  return existingName ? `Will use existing ${existingName} slot` : 'Will add a new cycle slot'
}
