import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { MicButton } from '@/components/ai/MicButton'
import { VoicePanel } from '@/components/ai/VoicePanel'
import { Spinner } from '@/components/ui/Loader'
import { useVoiceCapture } from '@/hooks/useVoiceCapture'
import { cn } from '@/lib/cn'

interface ChatComposerProps {
  onSend: (message: string) => void
  /** Luma is answering — typing is allowed, sending waits. */
  busy?: boolean
  /** Data still loading — nothing can be sent yet. */
  preparing?: boolean
}

const MAX_HEIGHT = 140

export function ChatComposer({ onSend, busy, preparing }: ChatComposerProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const blocked = busy || preparing

  // Spoken questions go straight out; the transcript shows as your message.
  const voice = useVoiceCapture((spoken) => {
    if (!blocked) onSend(spoken)
    else setValue(spoken)
  })

  // Grow with the text up to a few lines, then scroll inside.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
  }, [value])

  const send = () => {
    const text = value.trim()
    if (!text || blocked) return
    onSend(text)
    setValue('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div>
      <div
        className={cn(
          'flex min-h-[54px] items-end gap-2 rounded-hero border bg-card px-3 py-2 shadow-card transition-[border-color,box-shadow] duration-150',
          voice.active ? 'items-center border-rust/40 shadow-gold' : 'focus-within:border-ai/50 focus-within:shadow-ai border-border',
        )}
      >
        {voice.active ? (
          <VoicePanel state={voice.state} interim={voice.interim} onFinish={voice.finish} onCancel={voice.cancel} />
        ) : (
          <>
            <textarea
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={preparing ? 'Loading your data…' : 'Ask about your money, udhaar, SIPs or tasks…'}
              aria-label="Message"
              className="max-h-[140px] min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none"
            />
            <MicButton onClick={() => void voice.start()} />
            <button
              type="button"
              onClick={send}
              aria-label="Send message"
              disabled={!value.trim() || blocked}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ai text-[#F6F1E7] transition-[opacity,transform] hover:scale-105 disabled:scale-100 disabled:opacity-30"
            >
              {busy ? <Spinner size={13} /> : <ArrowUp size={15} />}
            </button>
          </>
        )}
      </div>
      <p className="mt-1.5 px-2 text-[10px] text-ink-muted">
        <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift</kbd>+<kbd className="font-sans">Enter</kbd> for a new line · 🎤 English or Hindi
      </p>
    </div>
  )
}
