import { Pencil, Trash2 } from 'lucide-react'
import { ACCOUNT_TYPE_META } from '@/lib/accountMeta'
import { formatCurrency } from '@/lib/formatCurrency'
import type { FinancialAccount } from '@/types'

interface AccountRowProps {
  account: FinancialAccount
  onEdit: (account: FinancialAccount) => void
  onDelete: (account: FinancialAccount) => void
}

export function AccountRow({ account, onEdit, onDelete }: AccountRowProps) {
  const meta = ACCOUNT_TYPE_META[account.type]
  const Icon = meta.icon
  const isCreditCard = account.type === 'credit_card'

  return (
    <div className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-bg-soft">
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
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          onClick={() => onEdit(account)}
          aria-label={`Edit ${account.name}`}
          className="rounded-xs p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-ink"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(account)}
          aria-label={`Delete ${account.name}`}
          className="rounded-xs p-1.5 text-ink-muted transition-colors hover:bg-card hover:text-danger"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
