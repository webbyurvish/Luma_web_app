import { Download, Search, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { CATEGORY_META } from '@/lib/categoryMeta'
import type { TransactionType } from '@/types'

interface TransactionsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  type: TransactionType | 'all'
  onTypeChange: (value: TransactionType | 'all') => void
  category: string
  onCategoryChange: (value: string) => void
  onExport: () => void
  onAdd: () => void
}

export function TransactionsFilters({
  search,
  onSearchChange,
  type,
  onTypeChange,
  category,
  onCategoryChange,
  onExport,
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
        <div className="w-full sm:w-40">
          <Select value={type} onChange={(event) => onTypeChange(event.target.value as TransactionType | 'all')} aria-label="Filter by type">
            <option value="all">All Types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="udhaar">Udhaar</option>
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select value={category} onChange={(event) => onCategoryChange(event.target.value)} aria-label="Filter by category">
            <option value="all">All Categories</option>
            {Object.values(CATEGORY_META).map((meta) => (
              <option key={meta.id} value={meta.id}>
                {meta.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="md" icon={<SlidersHorizontal size={15} />}>
          Filter
        </Button>
        <Button variant="secondary" size="md" icon={<Download size={15} />} onClick={onExport}>
          Export
        </Button>
        <Button size="md" onClick={onAdd}>
          Add Transaction
        </Button>
      </div>
    </div>
  )
}
