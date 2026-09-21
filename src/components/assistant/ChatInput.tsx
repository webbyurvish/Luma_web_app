import { type FormEvent, useState } from 'react'
import { ArrowUp, Mic, Paperclip } from 'lucide-react'
import { mockSuggestedPrompts } from '@/data/mockAssistant'

interface ChatInputProps {
  onSend: (message: string) => void
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    onSend(value.trim())
    setValue('')
  }

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-3 flex flex-wrap gap-2">
        {mockSuggestedPrompts.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => onSend(prompt.label)}
            className="rounded-pill border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-ai hover:text-ai"
          >
            {prompt.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-hero border border-border bg-card px-3 py-2.5 shadow-card">
        <button type="button" aria-label="Attach file" className="shrink-0 rounded-full p-2 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink">
          <Paperclip size={17} />
        </button>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ask your personal assistant..."
          aria-label="Message"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <button type="button" aria-label="Voice input" className="shrink-0 rounded-full p-2 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink">
          <Mic size={17} />
        </button>
        <button
          type="submit"
          aria-label="Send message"
          disabled={!value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ai text-white transition-opacity disabled:opacity-40"
        >
          <ArrowUp size={17} />
        </button>
      </form>
    </div>
  )
}
