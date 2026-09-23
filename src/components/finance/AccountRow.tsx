import { ACCOUNT_TYPE_META } from '@/lib/accountMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import type { FinancialAccount } from '@/types'

interface AccountRowProps {
  account: FinancialAccount
}

export function AccountRow({ account }: AccountRowProps) {
  const meta = ACCOUNT_TYPE_META[account.type]
  const Icon = meta.icon
  const isCreditCard = account.type === 'credit_card'

  return (
    <div className="flex items-center gap-3 rounded-xs px-2 py-2.5 transition-colors hover:bg-bg-soft">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-bg-soft text-ink-soft">
        <Icon size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{account.name}</p>
        <p className="truncate text-[10.5px] text-ink-muted">
          {meta.label}
          {account.accountNumberLast4 && <> · •••• {account.accountNumberLast4}</>}
        </p>
      </div>
      <div className="text-right">
        <p className={`font-mono-figure text-xs font-semibold ${isCreditCard && account.balance > 0 ? 'text-danger' : 'text-ink'}`}>
          {formatCurrency(account.balance)}
        </p>
        {isCreditCard && account.balance > 0 && <p className="text-[10px] uppercase tracking-[0.05em] text-ink-muted">Outstanding</p>}
      </div>
    </div>
  )
}
