import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Render untrusted recipe text without executing HTML or loading remote images. */
export function RecipeMarkdown({ text, omitLeadingTitle = false }: { text: string; omitLeadingTitle?: boolean }) {
  const content = omitLeadingTitle ? text.replace(/^(?:[ \t]*\r?\n)*#[ \t]+[^\r\n]+(?:\r?\n|$)/, '') : text
  return <div className="recipe-document recipe-markdown">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</>,
        img: ({ alt }) => <span>{alt ? `[Image: ${alt}]` : '[Image]'}</span>,
        input: ({ checked }) => <input type="checkbox" checked={Boolean(checked)} readOnly disabled aria-label={checked ? 'Completed' : 'Not completed'}/>,
        table: ({ children }) => <div className="recipe-table-wrap"><table>{children}</table></div>,
      }}
    >{content}</ReactMarkdown>
  </div>
}
