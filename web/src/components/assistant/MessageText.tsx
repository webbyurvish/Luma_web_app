import { Fragment, type ReactNode } from 'react'

/** **bold** → <strong>; everything else stays plain text (React escapes it). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  )
}

/**
 * Renders an assistant reply's light markdown — paragraphs, "-"/"*"/"1." lists and **bold** —
 * as React elements. Deliberately never uses innerHTML, so model output can't inject markup.
 */
export function MessageText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>)
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="ml-4 list-decimal space-y-0.5">{items}</ol>
      ) : (
        <ul key={blocks.length} className="ml-4 list-disc space-y-0.5">{items}</ul>
      ),
    )
    list = null
  }

  text.split('\n').forEach((raw) => {
    const line = raw.trim()
    const bullet = /^[-*•]\s+(.*)/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)/.exec(line)
    if (bullet || numbered) {
      const ordered = !!numbered
      if (!list || list.ordered !== ordered) {
        flush()
        list = { ordered, items: [] }
      }
      list.items.push((bullet ?? numbered)![1])
      return
    }
    flush()
    if (!line) return
    const heading = /^#{1,4}\s+(.*)/.exec(line)
    blocks.push(
      <p key={blocks.length} className={heading ? 'font-semibold' : undefined}>
        {inline(heading ? heading[1] : line)}
      </p>,
    )
  })
  flush()

  return <div className="space-y-2">{blocks}</div>
}
