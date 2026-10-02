import { cn } from '@/lib/cn'
import { Archive, Pencil, Trash2 } from 'lucide-react'
import { ACCOUNT_TYPE_META } from '@/lib/accountMeta'
import { RowActions } from '@/components/ui/RowActions'
import { formatCurrency } from '@/lib/formatCurrency'
import type { FinancialAccount } from '@/types'

interface AccountRowProps {
  account: FinancialAccount
  onEdit: (account: FinancialAccount) => void
  onArchive: (account: FinancialAccount) => void
  onDelete: (account: FinancialAccount) => void
  /** Opens the account's linked activity. */
  onOpen?: (account: FinancialAccount) => void
}

export function AccountRow({ account, onEdit, onArchive, onDelete, onOpen }: AccountRowProps) {
  const meta = ACCOUNT_TYPE_META[account.type]
  const Icon = meta.icon
  const isCreditCard = account.type === 'credit_card'

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(account)}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen?.(account)}
      className={cn('group flex items-center gap-3 rounded-xs px-2 py-2.5 transition-colors hover:bg-bg-soft', onOpen && 'cursor-pointer')}
    >
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-bg-soft text-ink-soft">
        <Icon size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-xs font-medium leading-snug text-ink sm:truncate">{account.name}</p>
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
      <RowActions
        label={`Actions for ${account.name}`}
        actions={[
          { label: 'Edit', ariaLabel: `Edit ${account.name}`, icon: <Pencil size={13} />, onClick: () => onEdit(account) },
          { label: 'Archive', ariaLabel: `Archive ${account.name}`, icon: <Archive size={13} />, onClick: () => onArchive(account), tone: 'warning' },
          { label: 'Delete', ariaLabel: `Delete ${account.name} permanently`, icon: <Trash2 size={13} />, onClick: () => onDelete(account), tone: 'danger' },
        ]}
      />
    </div>
  )
}
