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
    <div className={cn('border-t border-border-soft pt-3.5', compact && 'border-t-0 pt-0')}>
      {!compact && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {mockSuggestedPrompts.map((prompt) => (
            <button key={prompt.id} onClick={() => onSend(prompt.label)} className="text-[11px] text-ink-soft transition-colors hover:text-ai">
              {prompt.label}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={cn('flex items-center gap-2.5 border-b pb-2 transition-colors duration-150', focused ? 'border-ink' : 'border-border')}
      >
        <button type="button" aria-label="Attach file" className="shrink-0 text-ink-muted transition-colors hover:text-ink">
          <Paperclip size={14} />
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
        <button type="button" aria-label="Voice input" className="shrink-0 text-ink-muted transition-colors hover:text-ink">
          <Mic size={14} />
        </button>
        <button
          type="submit"
          aria-label="Send message"
          disabled={!value.trim()}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ai text-[#F6F1E7] transition-opacity disabled:opacity-30"
        >
          <ArrowUp size={13} />
        </button>
      </form>
    </div>
  )
}
