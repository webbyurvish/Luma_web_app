import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'

/** Small arc spinner that inherits its colour from the surrounding text — for buttons and inline spots. */
export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('animate-spin-smooth shrink-0', className)}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.5" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The signature loader: three ledger lines being "written" in turn by a rust nib, in the
 * same analog-journal language as the rest of the app. Used wherever a whole surface is
 * waiting on the sheet (form save overlays, slow first loads).
 */
export function LedgerLoader({ label, hint, className }: { label?: string; hint?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center text-center', className)}>
      <div className="relative w-[104px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative mb-[10px] h-[3px] overflow-hidden rounded-full bg-border-soft last:mb-0">
            <span
              className="animate-ledger-ink absolute inset-y-0 left-0 rounded-full bg-rust"
              style={{ animationDelay: `${i * 0.294}s`, width: i === 2 ? '62%' : '100%' }}
            />
          </div>
        ))}
        <span className="animate-ledger-nib absolute -top-[3px] -left-[4px] h-[9px] w-[9px] rounded-full bg-rust shadow-gold ring-2 ring-card" />
      </div>
      {label && <p className="mt-4 font-display text-[15px] italic text-ink">{label}</p>}
      {hint && <p className="mt-1 text-[11px] text-ink-muted">{hint}</p>}
      {!label && <span className="sr-only">Loading</span>}
    </div>
  )
}

/**
 * Covers a panel/modal body while a save is in flight: the form stays visible underneath
 * (so the user sees what's being saved) but can't be edited.
 */
export function SavingOverlay({ show, label = 'Saving to your ledger…', hint = 'Syncing with Google Sheets' }: { show: boolean; label?: string; hint?: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 z-20 flex items-center justify-center bg-card/75 backdrop-blur-[1.5px]"
        >
          <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05, duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
            <LedgerLoader label={label} hint={hint} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Thin indeterminate bar pinned to the top edge of a card while it quietly re-syncs after
 * a change. The existing content stays on screen — only this bar signals the refresh.
 */
export function SyncBar({ active, className }: { active: boolean; className?: string }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          role="progressbar"
          aria-label="Syncing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className={cn('pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] overflow-hidden rounded-t-[inherit] bg-rust-soft/60', className)}
        >
          <span className="animate-sync-slide absolute inset-y-0 w-1/3 rounded-full bg-rust" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Small "Syncing…" pill for card headers, paired with SyncBar. */
export function SyncBadge({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.span
          initial={{ opacity: 0, x: 4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          className="inline-flex items-center gap-1.5 rounded-pill bg-rust-soft/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-rust-dark"
        >
          <Spinner size={10} />
          Syncing
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/**
 * Shown under a skeleton only once a load has taken longer than `delay` ms — Apps Script
 * cold starts can take several seconds, and a bare shimmer that long starts to feel stuck.
 */
export function SlowLoadHint({ delay = 1500, message = 'Fetching from your ledger…' }: { delay?: number; message?: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <AnimatePresence>
      {visible && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 pt-3 text-[11px] text-ink-muted"
        >
          <Spinner size={11} className="text-rust" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
