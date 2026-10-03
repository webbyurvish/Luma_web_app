import { Download, FileUp, Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { Button } from '@/components/ui/Button'
import { CATEGORY_META } from '@/lib/categoryMeta'
import type { FinancialAccount, TransactionType } from '@/types'

const typeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'udhaar', label: 'Udhaar' },
]

const categoryOptions = [
  { value: 'all', label: 'All Categories' },
  ...Object.values(CATEGORY_META).map((meta) => ({ value: meta.id, label: meta.label })),
]

interface TransactionsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  type: TransactionType | 'all'
  onTypeChange: (value: TransactionType | 'all') => void
  category: string
  onCategoryChange: (value: string) => void
  /** 'all', 'none' (not linked) or an account id. */
  account: string
  onAccountChange: (value: string) => void
  accounts: FinancialAccount[]
  onExport: () => void
  onImport: () => void
  onAdd: () => void
}

export function TransactionsFilters({
  search,
  onSearchChange,
  type,
  onTypeChange,
  category,
  onCategoryChange,
  account,
  onAccountChange,
  accounts,
  onExport,
  onImport,
  onAdd,
}: TransactionsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-64">
          <Input
            icon={<Search size={16} />}
            placeholder="Search transactions..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search transactions"
          />
        </div>
        {/* Phones: the three filters share one row. */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
        <div className="min-w-0 sm:w-40">
          <ThemedSelect
            value={type}
            onChange={(next) => onTypeChange(next as TransactionType | 'all')}
            options={typeOptions}
            aria-label="Filter by type"
          />
        </div>
        <div className="min-w-0 sm:w-44">
          <ThemedSelect
            value={account}
            onChange={onAccountChange}
            options={[
              { value: 'all', label: 'All accounts' },
              ...accounts.filter((a) => a.isActive || a.id === account).map((a) => ({ value: a.id, label: a.name })),
              { value: 'none', label: 'Not linked' },
            ]}
            aria-label="Filter by account"
          />
        </div>
        <div className="min-w-0 sm:w-44">
          <ThemedSelect value={category} onChange={onCategoryChange} options={categoryOptions} aria-label="Filter by category" />
        </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" icon={<FileUp size={13} />} onClick={onImport}>
          Import
        </Button>
        <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={onExport}>
          Export
        </Button>
        <Button size="sm" className="flex-1 sm:flex-none" onClick={onAdd}>
          Add transaction
        </Button>
      </div>
    </div>
  )
}
