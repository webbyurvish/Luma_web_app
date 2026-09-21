import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { LumaSpark } from '@/components/assistant/LumaSpark'
import { mockSuggestedPrompts } from '@/data/mockAssistant'

export function AIInsightCard() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    navigate('/assistant')
  }

  return (
    <Card hoverable variant="tint" className="bg-gradient-lavender flex h-full flex-col">
      <div className="mb-4 flex items-center gap-3">
        <LumaSpark size={34} />
        <div>
          <h3 className="text-sm font-semibold text-ink">Ask your assistant</h3>
          <p className="text-xs text-ink-soft">Your finances, documents and tasks — all in one place</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex items-center gap-2 rounded-btn border border-white/60 bg-white/60 px-3.5 py-2.5 transition-shadow focus-within:shadow-ai">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask me anything..."
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            aria-label="Ask your assistant"
          />
          <button type="submit" aria-label="Send" className="shrink-0 text-ai transition-transform hover:translate-x-0.5">
            <ArrowRight size={17} />
          </button>
        </div>
      </form>

      <div className="mt-auto flex flex-wrap gap-2">
        {mockSuggestedPrompts.slice(0, 3).map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => navigate('/assistant')}
            className="rounded-pill border border-white/60 bg-white/50 px-3 py-1.5 text-[11px] font-medium text-ink-soft transition-colors hover:border-ai hover:text-ai"
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </Card>
  )
}
