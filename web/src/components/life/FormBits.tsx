import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
import { AccountSelect } from '@/components/finance/AccountSelect'
import { accountsForMethod } from '@/lib/accountLinking'
import { cn } from '@/lib/cn'
import type { FinancialAccount } from '@/types'

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-medium text-ink-soft">{label}</p>
      {children}
      {error ? <p className="mt-1 text-[11px] text-danger">{error}</p> : hint ? <p className="mt-1 text-[11px] text-ink-muted">{hint}</p> : null}
    </div>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'danger' | 'ok' }) {
  return (
    <Card className="min-w-0 px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="text-[9.5px] font-semibold uppercase leading-tight tracking-[0.06em] text-ink-muted sm:text-[10.5px] sm:tracking-[0.08em]">{label}</p>
      <p className={cn('mt-1 truncate font-mono-figure text-[15px] font-semibold sm:text-xl', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</p>
      <p className={cn('mt-0.5 truncate text-[11px]', tone === 'ok' ? 'text-success' : 'text-ink-muted')}>{hint}</p>
    </Card>
  )
}

export function Chips<T extends string>({ value, options, onChange, labels }: { value: T; options: readonly T[]; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
            value === o ? 'border-ink bg-ink text-paper' : 'border-border text-ink-soft hover:bg-bg-soft',
          )}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  )
}

/** "Also add this to my transactions" — for payments that aren't in Luma yet (cash, card…). */
export function RecordExpense({
  on,
  onToggle,
  accountId,
  onAccount,
  accounts,
  label = 'Also add it to my transactions',
  hint = 'Turn off if this payment is already in Luma (e.g. from a Google Pay import).',
  accountLabel = 'Paid from',
}: {
  on: boolean
  onToggle: (on: boolean) => void
  accountId: string
  onAccount: (id: string) => void
  accounts: FinancialAccount[]
  label?: string
  hint?: string
  accountLabel?: string
}) {
  const { suggested, others } = accountsForMethod(accounts, 'UPI')
  return (
    <div className="space-y-3 rounded-md border border-border-soft p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink">{label}</p>
          <p className="text-[11px] text-ink-muted">{hint}</p>
        </div>
        <Switch checked={on} onChange={onToggle} label={label} />
      </div>
      {on && <AccountSelect label={accountLabel} value={accountId} onChange={onAccount} suggested={suggested} others={others} />}
    </div>
  )
}
