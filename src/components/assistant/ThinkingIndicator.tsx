import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LumaSpark } from './LumaSpark'

const STEPS = ['Reading your ledger…', 'Adding up the numbers…', 'Checking accounts, SIPs and udhaar…', 'Writing the answer…']

/** Luma's "thinking" row: rotating progress lines over two shimmering text lines. */
export function ThinkingIndicator() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex gap-3" role="status" aria-live="polite">
      <LumaSpark size={26} animated className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex h-4 items-center gap-2 overflow-hidden">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai/70" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-[11px] text-ink-muted"
            >
              {STEPS[step]}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="skeleton-shimmer animate-shimmer h-2.5 w-4/5 rounded-full" />
          <div className="skeleton-shimmer animate-shimmer h-2.5 w-3/5 rounded-full" />
        </div>
      </div>
    </div>
  )
}
