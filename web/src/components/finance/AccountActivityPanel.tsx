import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, HandCoins } from 'lucide-react'
import { SlideOver } from '@/components/ui/SlideOver'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ACCOUNT_TYPE_META } from '@/lib/accountMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/cn'
import type { FinancialAccount, Transaction, UdhaarEntry } from '@/types'

interface ActivityItem {
  id: string
  date: string
  title: string
  detail: string
  /** Effect on this account's balance (for a card: on what's owed). */
  effect: number
}

/** Same rules as the ledger: money-holding accounts gain on income, cards owe more on spending. */
function effectOn(account: FinancialAccount, delta: number) {
  return account.type === 'credit_card' ? -delta : delta
}

interface AccountActivityPanelProps {
  account: FinancialAccount | null
  transactions: Transaction[]
  udhaar: UdhaarEntry[]
  accountNames: Map<string, string>
  onClose: () => void
  onEdit: (account: FinancialAccount) => void
}

/** Everything linked to one account, newest first, with each entry's effect on the balance. */
export function AccountActivityPanel({ account, transactions, udhaar, accountNames, onClose, onEdit }: AccountActivityPanelProps) {
  const navigate = useNavigate()

  const items = useMemo<ActivityItem[]>(() => {
    if (!account) return []
    const fromTx = transactions
      .filter((t) => t.accountId === account.id || t.toAccountId === account.id)
      .map((t) => {
        let delta = 0
        if (t.type === 'expense') delta = -t.amount
        else if (t.type === 'income') delta = t.amount
        else if (t.type === 'transfer') delta = t.toAccountId === account.id ? t.amount : -t.amount
        const detail =
          t.type === 'transfer'
            ? t.toAccountId === account.id
              ? `Transfer from ${accountNames.get(t.accountId ?? '') ?? 'another account'}`
              : `Transfer to ${accountNames.get(t.toAccountId ?? '') ?? 'another account'}`
            : [t.rawCategory, t.payment !== 'Other' ? t.payment : ''].filter(Boolean).join(' · ')
        return { id: t.id, date: t.date, title: t.type === 'transfer' ? t.note || 'Transfer' : t.description, detail, effect: effectOn(account, delta) }
      })
    const fromUdhaar = udhaar
      .filter((u) => u.accountId === account.id)
      .map((u) => ({
        id: u.id,
        date: u.date,
        title: u.type === 'given' ? `Udhaar to ${u.person}` : `Repaid by ${u.person}`,
        detail: 'Udhaar',
        effect: effectOn(account, u.type === 'given' ? -u.amount : u.amount),
      }))
    return [...fromTx, ...fromUdhaar].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [account, transactions, udhaar, accountNames])

  if (!account) return <SlideOver open={false} onClose={onClose} title="">{null}</SlideOver>

  const meta = ACCOUNT_TYPE_META[account.type]
  const isCard = account.type === 'credit_card'
  const inflow = items.filter((i) => i.effect > 0).reduce((s, i) => s + i.effect, 0)
  const outflow = items.filter((i) => i.effect < 0).reduce((s, i) => s - i.effect, 0)

  return (
    <SlideOver
      open={account !== null}
      onClose={onClose}
      title={account.name}
      subtitle={`${meta.label}${account.institution ? ` · ${account.institution}` : ''}${account.accountNumberLast4 ? ` · ••${account.accountNumberLast4}` : ''}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(account)}>
            Edit account
          </Button>
          <Button type="button" size="sm" icon={<ArrowRight size={13} />} iconPosition="right" onClick={() => navigate('/transactions', { state: { accountId: account.id } })}>
            All transactions
          </Button>
        </div>
      }
    >
      <div className="rounded-card border border-border-soft bg-bg-soft/60 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{isCard ? 'Outstanding' : 'Current balance'}</p>
        <p className={cn('mt-1 font-mono-figure text-2xl font-bold', isCard && account.balance > 0 ? 'text-danger' : 'text-ink')}>{formatCurrency(account.balance)}</p>
        {items.length > 0 && (
          <p className="mt-1.5 text-[11px] text-ink-soft">
            {isCard ? (
              <>
                {formatCurrency(inflow)} spent · {formatCurrency(outflow)} paid off
              </>
            ) : (
              <>
                {formatCurrency(inflow)} in · {formatCurrency(outflow)} out
              </>
            )}{' '}
            across {items.length} linked {items.length === 1 ? 'entry' : 'entries'}
          </p>
        )}
      </div>

      <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Linked activity</p>
      {items.length === 0 ? (
        <EmptyState
          icon={<HandCoins size={20} />}
          title="Nothing linked yet"
          description="When you add an expense, income, transfer or udhaar, pick this account and its balance updates automatically."
        />
      ) : (
        <ul className="divide-y divide-border-soft">
          {items.slice(0, 60).map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{item.title}</p>
                <p className="truncate text-[10.5px] text-ink-muted">
                  {formatDate(item.date)}
                  {item.detail && ` · ${item.detail}`}
                </p>
              </div>
              <span className={cn('shrink-0 font-mono-figure text-xs font-semibold', (item.effect > 0) !== isCard ? 'text-success' : 'text-ink')}>
                {formatCurrency(item.effect, { signed: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SlideOver>
  )
}
