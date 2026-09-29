import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SUGGESTED_PROMPTS } from '@/lib/assistantPrompts'

export function AIInsightCard() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (query.trim()) navigate('/assistant', { state: { ask: query.trim() } })
    else navigate('/assistant')
  }

  return (
    <Card hoverable variant="inset" className="flex h-full flex-col">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ai">Ask Luma</p>
      <p className="mt-1.5 font-display text-base italic leading-snug text-ink">"How did I spend this month?"</p>

      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex items-center gap-2 border-b border-ink/25 pb-1.5 transition-colors focus-within:border-ink">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask anything..."
            className="w-full bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
            aria-label="Ask your assistant"
          />
          <button type="submit" aria-label="Send" className="shrink-0 text-ai transition-transform hover:translate-x-0.5">
            <ArrowRight size={15} />
          </button>
        </div>
      </form>

      <ul className="mt-4 space-y-1.5">
        {SUGGESTED_PROMPTS.slice(0, 3).map((prompt) => (
          <li key={prompt}>
            <button
              onClick={() => navigate('/assistant', { state: { ask: prompt } })}
              className="text-left text-[11px] text-ink-soft transition-colors hover:text-ai"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
