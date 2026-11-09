import type { ReactNode } from 'react'

/** A deliberately small Markdown subset. Text is always rendered as React text, never HTML. */
function inline(text: string): ReactNode[] {
  const pattern = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g
  return text.split(pattern).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
    return part
  })
}

export function SetupText({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  for (let i = 0; i < lines.length;) {
    if (!lines[i].trim()) { i++; continue }
    const item = lines[i].match(/^\s*(?:([-*])\s+|(\d+)\.\s+)(.*)$/)
    if (item) {
      const numbered = Boolean(item[2]); const items: ReactNode[] = []
      while (i < lines.length) {
        const match = lines[i].match(/^\s*(?:([-*])\s+|(\d+)\.\s+)(.*)$/)
        if (!match || Boolean(match[2]) !== numbered) break
        items.push(<li key={i}>{inline(match[3])}</li>); i++
      }
      blocks.push(numbered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>)
    } else {
      blocks.push(<p key={i}>{inline(lines[i])}</p>); i++
    }
  }
  return <div className="setup-markdown">{blocks}</div>
}
