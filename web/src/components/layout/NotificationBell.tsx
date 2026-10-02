import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BellOff, CalendarClock, CheckCheck, FileWarning, Gift, HandCoins, ListChecks, PiggyBank, Receipt, Smartphone, X, type LucideIcon } from 'lucide-react'
import { useNotifications, type AppNotification, type NotificationTone } from '@/hooks/useNotifications'
import { cn } from '@/lib/cn'

const KIND_ICON: Record<AppNotification['kind'], LucideIcon> = {
  bill: Receipt,
  budget: PiggyBank,
  task: ListChecks,
  sip: CalendarClock,
  udhaar: HandCoins,
  document: FileWarning,
  recharge: Smartphone,
  date: Gift,
}

const TONE: Record<NotificationTone, { dot: string; icon: string; label: string }> = {
  danger: { dot: 'bg-danger', icon: 'bg-danger-soft text-danger', label: 'Needs action' },
  warn: { dot: 'bg-warning', icon: 'bg-warning-soft text-warning', label: 'Coming up' },
  info: { dot: 'bg-info', icon: 'bg-bg-soft text-ink-soft', label: 'For your info' },
}

export function NotificationBell() {
  const navigate = useNavigate()
  const { notifications, urgent, dismiss, dismissAll } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const count = notifications.length
  const hasDanger = notifications.some((n) => n.tone === 'danger')
  const groups = (['danger', 'warn', 'info'] as NotificationTone[]).map((tone) => ({ tone, items: notifications.filter((n) => n.tone === tone) })).filter((g) => g.items.length)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={count ? `Notifications, ${count} new` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border text-ink-soft transition-colors hover:border-ink-soft hover:text-ink',
          open ? 'border-ink-soft text-ink' : 'border-border',
        )}
      >
        <Bell size={15} />
        {count > 0 && (
          <span
            className={cn(
              'absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono-figure text-[9.5px] font-bold text-paper ring-2 ring-bg',
              hasDanger ? 'bg-danger' : urgent ? 'bg-warning' : 'bg-ink-soft',
            )}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-3 top-[68px] z-50 origin-top-right overflow-hidden rounded-card border border-border bg-card shadow-hover sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-[380px]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-ink">Notifications</p>
                <p className="text-[10.5px] text-ink-muted">{count ? `${count} thing${count === 1 ? '' : 's'} to look at` : 'All caught up'}</p>
              </div>
              {count > 0 && (
                <button type="button" onClick={dismissAll} className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-ink-soft hover:bg-bg-soft hover:text-ink">
                  <CheckCheck size={13} /> Clear all
                </button>
              )}
            </div>

            {count === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-soft text-ink-muted">
                  <BellOff size={18} />
                </span>
                <p className="mt-3 text-xs font-medium text-ink">Nothing needs you right now</p>
                <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-ink-muted">Bills due, budgets near their limit, overdue tasks and expiring documents show up here.</p>
              </div>
            ) : (
              <div className="max-h-[min(70vh,460px)] overflow-y-auto">
                {groups.map((group) => (
                  <div key={group.tone}>
                    <p className="flex items-center gap-1.5 bg-bg-soft/50 px-4 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      <span className={cn('h-1.5 w-1.5 rounded-full', TONE[group.tone].dot)} />
                      {TONE[group.tone].label}
                    </p>
                    <ul className="divide-y divide-border-soft">
                      {group.items.map((n) => {
                        const Icon = KIND_ICON[n.kind]
                        return (
                          <li key={n.id} className="group flex items-start gap-3 px-4 py-2.5 hover:bg-bg-soft/60">
                            <button
                              type="button"
                              onClick={() => {
                                setOpen(false)
                                navigate(n.to, n.state ? { state: n.state } : undefined)
                              }}
                              className="flex min-w-0 flex-1 items-start gap-3 text-left"
                            >
                              <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', TONE[n.tone].icon)}>
                                <Icon size={13} />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium text-ink">{n.title}</span>
                                <span className="block text-[11px] leading-snug text-ink-muted">{n.detail}</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => dismiss(n.id)}
                              aria-label="Dismiss"
                              className="mt-0.5 rounded-full p-1 text-ink-muted pointer-fine:opacity-60 transition-opacity hover:bg-card hover:text-ink pointer-fine:group-hover:opacity-100"
                            >
                              <X size={12} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
