import { useCallback, useRef } from 'react'
import { useSpeechInput, useSpeechPrewarm } from './useSpeechInput'
import { useToast } from '@/context/ToastContext'

/**
 * Dictation for an input: prewarms on mount, hands recognized text to `onText`, and turns
 * failures into toasts. `cancel` discards what was heard; `finish` keeps it.
 */
export function useVoiceCapture(onText: (text: string) => void) {
  useSpeechPrewarm()
  const { state, interim, listen, stop } = useSpeechInput()
  const { showToast } = useToast()
  const discardRef = useRef(false)

  const start = useCallback(async () => {
    discardRef.current = false
    try {
      const text = await listen()
      if (discardRef.current) return
      if (text) onText(text)
      else showToast("Didn't catch that. Try again a little closer to the mic.", 'info')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Voice input failed.', 'error')
    }
  }, [listen, onText, showToast])

  const finish = useCallback(() => stop(), [stop])
  const cancel = useCallback(() => {
    discardRef.current = true
    stop()
  }, [stop])

  return { state, interim, active: state !== 'idle', start, finish, cancel }
}
