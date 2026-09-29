import { Check, X } from 'lucide-react'
import { VoiceWave } from './VoiceWave'
import type { SpeechState } from '@/hooks/useSpeechInput'

interface VoicePanelProps {
  state: SpeechState
  interim: string
  onFinish: () => void
  onCancel: () => void
}

/** Replaces a text input while dictating: live zig-zag trace, running transcript, Done / Cancel. */
export function VoicePanel({ state, interim, onFinish, onCancel }: VoicePanelProps) {
  const live = state === 'listening'
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3" role="status" aria-live="polite">
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
        {live && <span className="absolute inset-0 animate-ping rounded-full bg-rust/60" />}
        <span className={`relative h-2.5 w-2.5 rounded-full ${live ? 'bg-rust' : 'bg-ink-muted'}`} />
      </span>
      <div className="min-w-0 flex-1">
        <VoiceWave live={live} className="h-7" />
        <p className="truncate text-[11px] text-ink-soft">
          {interim ? (
            <span className="font-display italic text-ink">{interim}</span>
          ) : live ? (
            'Listening… speak in English or Hindi'
          ) : (
            'Opening the microphone…'
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel voice input"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink"
      >
        <X size={15} />
      </button>
      <button
        type="button"
        onClick={onFinish}
        disabled={!live}
        aria-label="Done speaking"
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-rust px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-[#F6F1E7] transition-colors hover:bg-rust-dark disabled:opacity-50"
      >
        <Check size={13} /> Done
      </button>
    </div>
  )
}
