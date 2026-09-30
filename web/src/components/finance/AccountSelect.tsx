import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { ACCOUNT_TYPE_META } from '@/lib/accountMeta'
import { accountLabel, type BalanceChange } from '@/lib/accountLinking'
import { formatCurrency } from '@/lib/formatCurrency'
import { cn } from '@/lib/cn'
import type { FinancialAccount } from '@/types'

interface AccountSelectProps {
  label: string
  value: string
  onChange: (accountId: string) => void
  /** Shown first, under "Suggested" (e.g. bank accounts for UPI). */
  suggested: FinancialAccount[]
  others: FinancialAccount[]
  /** Allow leaving the entry unlinked. */
  allowNone?: boolean
  noneLabel?: string
  /** Live "before → after" for the chosen account. */
  change?: BalanceChange
  hint?: string
  error?: string
}

/** Account dropdown with icons, balances, suggested accounts first, and a balance preview. */
export function AccountSelect({ label, value, onChange, suggested, others, allowNone = true, noneLabel = "Don't link to an account", change, hint, error }: AccountSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const all = [...suggested, ...others]
  const selected = all.find((a) => a.id === value)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  const renderRow = (account: FinancialAccount) => {
    const Icon = ACCOUNT_TYPE_META[account.type].icon
    const isCard = account.type === 'credit_card'
    return (
      <button
        key={account.id}
        type="button"
        role="option"
        aria-selected={value === account.id}
        onClick={() => pick(account.id)}
        className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-bg-soft', value === account.id && 'bg-bg-soft')}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-soft text-ink-soft">
          <Icon size={12} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{accountLabel(account)}</span>
          <span className="block text-[10px] text-ink-muted">{ACCOUNT_TYPE_META[account.type].label}</span>
        </span>
        <span className={cn('shrink-0 font-mono-figure text-[11px]', isCard && account.balance > 0 ? 'text-danger' : 'text-ink-soft')}>
          {isCard ? `owes ${formatCurrency(account.balance)}` : formatCurrency(account.balance)}
        </span>
        {value === account.id && <Check size={13} className="shrink-0 text-rust" />}
      </button>
    )
  }

  const SelectedIcon = selected ? ACCOUNT_TYPE_META[selected.type].icon : null

  return (
    <div ref={ref} className="relative">
      <label className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center gap-2.5 rounded-btn border bg-surface px-3 text-left text-sm transition-colors hover:border-ink/30',
          error ? 'border-danger' : open ? 'border-rust' : 'border-border',
        )}
      >
        {selected && SelectedIcon ? (
          <>
            <SelectedIcon size={14} className="shrink-0 text-ink-soft" />
            <span className="min-w-0 flex-1 truncate text-ink">{accountLabel(selected)}</span>
          </>
        ) : (
          <span className="flex-1 text-ink-muted">{all.length ? noneLabel : 'No accounts yet — add one in Finance'}</span>
        )}
        <ChevronDown size={14} className={cn('shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>

      {change && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-soft">
          <span className="font-medium text-ink">{change.account.name}:</span>
          <span className="font-mono-figure">{formatCurrency(change.before)}</span>
          <ArrowRight size={11} className="text-ink-muted" />
          <span className={cn('font-mono-figure font-semibold', change.after < change.before === (change.account.type !== 'credit_card') ? 'text-danger' : 'text-success')}>
            {formatCurrency(change.after)}
          </span>
          {change.account.type === 'credit_card' && <span className="text-ink-muted">owed</span>}
        </p>
      )}
      {!change && hint && <p className="mt-1.5 text-[10.5px] text-ink-muted">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}

      {open && (
        <div role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-btn border border-border bg-card py-1 shadow-dropdown">
          {allowNone && (
            <button type="button" role="option" aria-selected={!value} onClick={() => pick('')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink-soft hover:bg-bg-soft">
              {noneLabel}
              {!value && <Check size={13} className="ml-auto text-rust" />}
            </button>
          )}
          {suggested.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Suggested</p>
              {suggested.map(renderRow)}
            </>
          )}
          {others.length > 0 && (
            <>
              {suggested.length > 0 && <p className="px-3 pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Other accounts</p>}
              {others.map(renderRow)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
