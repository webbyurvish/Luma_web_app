import { motion } from 'framer-motion'
import { AlertTriangle, Check, Copy, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { LumaSpark } from './LumaSpark'
import { MessageText } from './MessageText'
import { useTypewriter } from './useTypewriter'
import { formatTime } from '@/lib/formatDate'
import type { ChatMessage } from '@/types'

interface ChatMessageItemProps {
  message: ChatMessage
  /** Type the reply out (only for answers that arrived in this session). */
  animate?: boolean
  onRetry?: () => void
}

export function ChatMessageItem({ message, animate = false, onRetry }: ChatMessageItemProps) {
  if (message.role === 'user') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="flex justify-end">
        <div className="max-w-[80%] text-right">
          <div className="inline-block rounded-card rounded-br-xs border border-border-soft bg-bg-soft px-4 py-2.5 text-left">
            <p className="font-display text-[15px] italic leading-relaxed text-ink">{message.content}</p>
          </div>
          <p className="mt-1 pr-1 font-mono-figure text-[10px] text-ink-muted">{formatTime(message.timestamp)}</p>
        </div>
      </motion.div>
    )
  }
  return <AssistantMessage message={message} animate={animate} onRetry={onRetry} />
}

function AssistantMessage({ message, animate, onRetry }: Required<Pick<ChatMessageItemProps, 'message' | 'animate'>> & Pick<ChatMessageItemProps, 'onRetry'>) {
  const { shown, done } = useTypewriter(message.content, animate && !message.error)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked — nothing useful to do.
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="group flex gap-3">
      <LumaSpark size={26} className="mt-0.5 shrink-0" />
      <div className="min-w-0 max-w-[88%] flex-1">
        <p className="mb-1 flex items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ai">Luma</span>
          <span className="font-mono-figure text-[10px] text-ink-muted">{formatTime(message.timestamp)}</span>
        </p>

        {message.error ? (
          <div className="flex items-start gap-2.5 rounded-card border border-danger/25 bg-danger-soft/60 px-3.5 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink">
              <p>{message.content}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.04em] text-rust hover:underline"
                >
                  <RotateCcw size={11} /> Try again
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="ledger-marker ledger-marker-ai pl-3.5 text-sm leading-relaxed text-ink">
            <MessageText text={shown} />
            {!done && <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-ai" aria-hidden="true" />}
          </div>
        )}

        {!message.error && done && (
          <div className="mt-1.5 flex items-center gap-1 pl-3 pointer-fine:opacity-0 transition-opacity pointer-fine:group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={copy}
              aria-label="Copy answer"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.04em] text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink"
            >
              {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                aria-label="Ask again"
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.04em] text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink"
              >
                <RotateCcw size={11} /> Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
