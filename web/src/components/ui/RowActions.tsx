import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface RowAction {
  label: string
  icon: ReactNode
  onClick: () => void
  tone?: 'default' | 'warning' | 'danger'
  /** Accessible name for the desktop icon button (defaults to label). */
  ariaLabel?: string
  hidden?: boolean
}

const TONE_HOVER: Record<NonNullable<RowAction['tone']>, string> = {
  default: 'hover:bg-bg-soft hover:text-ink',
  warning: 'hover:bg-warning-soft hover:text-warning',
  danger: 'hover:bg-danger-soft hover:text-danger',
}
const TONE_TEXT: Record<NonNullable<RowAction['tone']>, string> = { default: 'text-ink', warning: 'text-warning', danger: 'text-danger' }

/**
 * A row's actions. With a mouse: small icon buttons that appear on hover (keeps lists calm).
 * On touch screens: one "⋯" button opening a labelled menu with full-height rows — so action
 * icons never squeeze the row's name off a phone screen.
 */
export function RowActions({ actions, label = 'More actions', className }: { actions: RowAction[]; label?: string; className?: string }) {
  const visible = actions.filter((a) => !a.hidden)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    const menuHeight = visible.length * 44 + 12
    const up = r.bottom + menuHeight + 8 > window.innerHeight
    setPos({ top: up ? r.top - menuHeight - 4 : r.bottom + 4, right: Math.max(8, window.innerWidth - r.right), up })
  }, [open, visible.length])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    window.addEventListener('scroll', () => setOpen(false), { capture: true, once: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!visible.length) return null

  return (
    <div className={cn('flex shrink-0 items-center', className)} onClick={(e) => e.stopPropagation()}>
      {/* Mouse: hover-revealed icons */}
      <div className="hidden items-center gap-0.5 transition-opacity pointer-fine:flex pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
        {visible.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            aria-label={a.ariaLabel ?? a.label}
            title={a.label}
            className={cn('rounded-full p-1.5 text-ink-muted transition-colors', TONE_HOVER[a.tone ?? 'default'])}
          >
            {a.icon}
          </button>
        ))}
      </div>

      {/* Touch: one button, labelled menu */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-bg-soft hover:text-ink pointer-fine:hidden"
      >
        <MoreHorizontal size={17} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, right: pos.right }}
            className={cn(
              'fixed z-[90] min-w-[176px] overflow-hidden rounded-card border border-border bg-card py-1.5 shadow-dropdown',
              pos.up ? 'origin-bottom-right' : 'origin-top-right',
            )}
          >
            {visible.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  a.onClick()
                }}
                className={cn('flex h-11 w-full items-center gap-3 px-4 text-left text-[13px] active:bg-bg-soft', TONE_TEXT[a.tone ?? 'default'])}
              >
                <span className="text-ink-muted [&>svg]:h-[15px] [&>svg]:w-[15px]">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
