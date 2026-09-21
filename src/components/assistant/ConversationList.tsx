import { MessageSquarePlus } from 'lucide-react'
import { formatDate } from '@/lib/formatDate'
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
        className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft transition-colors hover:text-ai"
      >
        <MessageSquarePlus size={13} />
        New conversation
      </button>
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {conversations.map((conversation) => {
          const isActive = activeId === conversation.id
          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cn(
                'relative w-full py-2 pl-3 pr-1 text-left transition-colors duration-150',
                isActive ? 'bg-bg-soft' : 'hover:bg-bg-soft/60',
              )}
            >
              <span className={cn('absolute left-0 top-1/2 h-3.5 w-[2.5px] -translate-y-1/2 bg-ai transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
              <p className={cn('truncate text-xs font-medium', isActive ? 'text-ink' : 'text-ink-soft')}>{conversation.title}</p>
              <p className="mt-0.5 truncate text-[10px] text-ink-muted">{conversation.preview}</p>
              <p className="mt-0.5 font-mono-figure text-[9px] text-ink-muted">{formatDate(conversation.updatedAt)}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
