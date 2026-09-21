import { motion } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { LumaSpark } from './LumaSpark'
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
            className={cn('flex items-start gap-3', !isAssistant && 'flex-row-reverse')}
          >
            {isAssistant ? (
              <LumaSpark size={28} className="mt-0.5 shrink-0" />
            ) : (
              <Avatar name="Urvish Krina" size={28} />
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[68%]',
                isAssistant
                  ? 'bg-gradient-lavender rounded-tl-md text-ink'
                  : 'rounded-tr-md border border-border-soft bg-card text-ink shadow-xs',
              )}
            >
              {message.content}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
