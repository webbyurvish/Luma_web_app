import { Mic } from 'lucide-react'
import { cn } from '@/lib/cn'

interface MicButtonProps {
  onClick: () => void
  size?: number
  className?: string
}

/** The idle mic trigger; while dictating, the input shows <VoicePanel> instead. */
export function MicButton({ onClick, size = 15, className }: MicButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Speak instead of typing"
      title="Speak (English or Hindi)"
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-rust-soft/60 hover:text-rust',
        className,
      )}
    >
      <Mic size={size} />
    </button>
  )
}
