import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { slideOverTransition } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { SavingOverlay } from './Loader'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** While true a saving overlay covers the body, the footer is locked, and Escape / backdrop / close are ignored. */
  busy?: boolean
  /** Overlay caption while busy (defaults to "Saving to your ledger…"). */
  busyLabel?: string
}

export function SlideOver({ open, onClose, title, subtitle, children, footer, className, busy = false, busyLabel }: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Callers typically pass an inline onClose (e.g. a requestClose that closes over
  // isDirty), which gets a new identity on every render — including every keystroke in
  // a field inside this panel. Reading it via a ref keeps the effect below scoped to
  // `open` only, so typing doesn't re-run it and steal focus back to the panel.
  const guardedClose = () => {
    if (!busy) onClose()
  }
  const onCloseRef = useRef(guardedClose)
  useEffect(() => {
    onCloseRef.current = guardedClose
  })

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    panelRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <motion.button
            aria-label="Close panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={guardedClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-busy={busy || undefined}
            aria-labelledby="slideover-title"
            tabIndex={-1}
            variants={slideOverTransition}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative z-10 flex h-full w-full flex-col border-l border-border bg-card shadow-hover outline-none sm:w-[440px] md:w-[480px]',
              className,
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border-soft px-5 py-4">
              <div className="min-w-0">
                <h2 id="slideover-title" className="font-display text-lg italic text-ink">
                  {title}
                </h2>
                {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
              </div>
              <button
                onClick={guardedClose}
                disabled={busy}
                aria-label="Close"
                className="shrink-0 rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative min-h-0 flex-1">
              <div className="h-full overflow-y-auto px-5 py-4" inert={busy || undefined}>
                {children}
              </div>
              <SavingOverlay show={busy} label={busyLabel} />
            </div>

            {footer && <div className="border-t border-border-soft px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
