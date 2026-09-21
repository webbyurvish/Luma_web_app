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
}

export function Modal({ open, onClose, title, subtitle, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.button
            aria-label="Close modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            tabIndex={-1}
            variants={modalTransition}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative z-10 w-full max-w-md rounded-hero border border-border-soft bg-card p-6 shadow-hover outline-none',
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
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink"
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
