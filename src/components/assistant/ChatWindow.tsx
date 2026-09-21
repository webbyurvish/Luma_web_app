import { Sparkles } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import type { ChatMessage } from '@/types'

export function ChatWindow({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-2">
      {messages.map((message) => {
        const isAssistant = message.role === 'assistant'
        return (
          <div key={message.id} className={cn('flex items-start gap-3', !isAssistant && 'flex-row-reverse')}>
            {isAssistant ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ai text-white">
                <Sparkles size={15} />
              </span>
            ) : (
              <Avatar name="Urvish Krina" size={32} />
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-card px-4 py-3 text-sm leading-relaxed sm:max-w-[70%]',
                isAssistant ? 'bg-ai-soft text-ink' : 'border border-border bg-card text-ink',
              )}
            >
              {message.content}
            </div>
          </div>
        )
      })}
    </div>
  )
}
