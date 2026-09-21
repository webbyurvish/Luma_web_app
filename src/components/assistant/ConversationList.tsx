import { MessageSquarePlus } from 'lucide-react'
import { formatFullDate } from '@/lib/formatDate'
import { cn } from '@/lib/cn'
import type { Conversation } from '@/types'

interface ConversationListProps {
  conversations: Conversation[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
}

export function ConversationList({ conversations, activeId, onSelect, onNew }: ConversationListProps) {
  return (
    <div className="flex h-full flex-col">
      <button
        onClick={onNew}
        className="mb-3 flex items-center justify-center gap-2 rounded-btn border border-dashed border-border py-2.5 text-xs font-medium text-ink-soft transition-colors hover:border-ai hover:text-ai"
      >
        <MessageSquarePlus size={15} />
        New conversation
      </button>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const isActive = activeId === conversation.id
          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cn(
                'relative w-full rounded-btn px-3 py-2.5 pl-4 text-left transition-colors duration-150',
                isActive ? 'bg-gradient-lavender' : 'hover:bg-bg-soft',
              )}
            >
              {isActive && <span className="absolute left-1.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-ai" aria-hidden="true" />}
              <p className={cn('truncate text-xs font-semibold', isActive ? 'text-ai' : 'text-ink')}>{conversation.title}</p>
              <p className="mt-0.5 truncate text-[11px] text-ink-soft">{conversation.preview}</p>
              <p className="mt-1 text-[10px] text-ink-muted">{formatFullDate(conversation.updatedAt)}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
