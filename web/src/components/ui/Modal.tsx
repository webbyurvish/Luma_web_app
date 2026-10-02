import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { modalTransition } from '@/lib/motion'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  /** While true the modal ignores Escape, backdrop clicks and the close button — a request is in flight. */
  busy?: boolean
}

export function Modal({ open, onClose, title, subtitle, children, className, busy = false }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Callers typically pass an inline onClose, which gets a new identity on every render
  // — including every keystroke in a field inside this modal. Reading it via a ref keeps
  // the effect below scoped to `open` only, so typing doesn't re-run it and steal focus
  // back to the dialog.
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
    dialogRef.current?.focus()
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
        // Phones: a bottom sheet (thumb-reachable, iOS-style); larger screens: a centred dialog.
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
          <motion.button
            aria-label="Close modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={guardedClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-busy={busy || undefined}
            aria-labelledby="modal-title"
            tabIndex={-1}
            variants={modalTransition}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              // Never taller than the visible screen (100dvh shrinks with the iPhone keyboard); scrolls inside.
              'relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-hero border border-border-soft bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-hover outline-none sm:max-h-[calc(100dvh-4rem)] sm:rounded-hero sm:p-6',
              className,
            )}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="modal-title" className="text-lg font-semibold tracking-tight text-ink">
                  {title}
                </h2>
                {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
              </div>
              <button
                onClick={guardedClose}
                disabled={busy}
                aria-label="Close"
                className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
