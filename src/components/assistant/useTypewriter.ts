import { useEffect, useState } from 'react'

/**
 * Reveals `text` progressively (about a second end to end, however long the answer), so a
 * reply that arrives all at once still reads as if it's being written. Off for old messages.
 */
export function useTypewriter(text: string, enabled: boolean): { shown: string; done: boolean } {
  const [count, setCount] = useState(enabled ? 0 : text.length)

  useEffect(() => {
    if (!enabled) return
    const step = Math.max(2, Math.ceil(text.length / 70))
    let current = 0
    let frame = 0
    const tick = () => {
      current = Math.min(text.length, current + step)
      setCount(current)
      if (current < text.length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text, enabled])

  return { shown: text.slice(0, count), done: count >= text.length }
}
