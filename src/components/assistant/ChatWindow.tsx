import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import { cn } from '@/lib/cn'
import type { ChatMessage } from '@/types'

export function ChatWindow({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto py-2">
      {messages.map((message, index) => {
        const isAssistant = message.role === 'assistant'
        return (
          <motion.div
            key={message.id}
            custom={index}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cn(isAssistant ? 'max-w-[85%]' : 'ml-auto max-w-[75%] text-right')}
          >
            <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-[0.1em]', isAssistant ? 'text-ai' : 'text-ink-muted')}>
              {isAssistant ? 'Luma' : 'You'}
            </p>
            {isAssistant ? (
              <p className="ledger-marker pl-3 text-sm leading-relaxed text-ink [&::before]:bg-ai">{message.content}</p>
            ) : (
              <p className="font-display text-[15px] italic leading-relaxed text-ink">{message.content}</p>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
