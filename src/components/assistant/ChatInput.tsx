import { type FormEvent, useState } from 'react'
import { ArrowUp, Mic, Paperclip } from 'lucide-react'
import { mockSuggestedPrompts } from '@/data/mockAssistant'
import { cn } from '@/lib/cn'

interface ChatInputProps {
  onSend: (message: string) => void
  compact?: boolean
}

export function ChatInput({ onSend, compact }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    onSend(value.trim())
    setValue('')
  }

  return (
    <div className={cn('border-t border-border-soft pt-4', compact && 'border-t-0 pt-0')}>
      {!compact && (
        <div className="mb-3 flex flex-wrap gap-2">
          {mockSuggestedPrompts.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => onSend(prompt.label)}
              className="rounded-pill border border-border-soft bg-card px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-ai hover:text-ai"
            >
              {prompt.label}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex items-center gap-2 rounded-hero border bg-card px-3 py-2.5 shadow-card transition-shadow duration-200',
          focused ? 'border-ai/40 shadow-ai' : 'border-border-soft',
        )}
      >
        <button type="button" aria-label="Attach file" className="shrink-0 rounded-full p-2 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink">
          <Paperclip size={17} />
        </button>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
          className="bg-gradient-aurora flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
        >
          <ArrowUp size={17} />
        </button>
      </form>
    </div>
  )
}
