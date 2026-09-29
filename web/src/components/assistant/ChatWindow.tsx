import { useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { ChatMessageItem } from './ChatMessageItem'
import { ThinkingIndicator } from './ThinkingIndicator'
import type { ChatMessage } from '@/types'

interface ChatWindowProps {
  messages: ChatMessage[]
  thinking: boolean
  /** Ids of answers that arrived in this session — only these type themselves out. */
  freshIds: Set<string>
  followUps: string[]
  onRetry: (assistantMessageId: string) => void
  onFollowUp: (prompt: string) => void
}

export function ChatWindow({ messages, thinking, freshIds, followUps, onRetry, onFollowUp }: ChatWindowProps) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, thinking])

  const last = messages.at(-1)
  const showFollowUps = !thinking && last?.role === 'assistant' && !last.error && followUps.length > 0

  return (
    <div className="flex flex-col gap-6 px-1 py-4" aria-live="polite">
      {messages.map((message) => (
        <ChatMessageItem
          key={message.id}
          message={message}
          animate={freshIds.has(message.id)}
          onRetry={message.role === 'assistant' && (message.error || message.id === last?.id) ? () => onRetry(message.id) : undefined}
        />
      ))}

      {thinking && <ThinkingIndicator />}

      {showFollowUps && (
        <div className="flex flex-wrap gap-2 pl-[38px]">
          {followUps.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onFollowUp(prompt)}
              className="group inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5 text-[11px] text-ink-soft transition-colors hover:border-ai/50 hover:text-ai"
            >
              {prompt}
              <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
