import { useMemo, useState } from 'react'
import { TransactionsFilters } from '@/components/transactions/TransactionsFilters'
import { TransactionsTable } from '@/components/transactions/TransactionsTable'
import { QuickActionModal } from '@/components/common/QuickActionModal'
import { mockTransactions } from '@/data/mockTransactions'
import { useToast } from '@/context/ToastContext'
import type { TransactionType } from '@/types'

const PAGE_SIZE = 8

export function Transactions() {
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TransactionType | 'all'>('all')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)

  const filtered = useMemo(() => {
    return [...mockTransactions]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .filter((item) => {
        const matchesSearch = item.description.toLowerCase().includes(search.toLowerCase())
        const matchesType = type === 'all' || item.type === type
        const matchesCategory = category === 'all' || item.category === category
        return matchesSearch && matchesType && matchesCategory
      })
  }, [search, type, category])

  return (
    <div className="flex flex-col gap-5 pt-4">
      <TransactionsFilters
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        type={type}
        onTypeChange={(value) => {
          setType(value)
          setPage(1)
        }}
        category={category}
        onCategoryChange={(value) => {
          setCategory(value)
          setPage(1)
        }}
        onExport={() => showToast('Export is coming in a future phase', 'info')}
        onAdd={() => setAddOpen(true)}
      />

      <TransactionsTable transactions={filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <QuickActionModal open={addOpen} kind="expense" onClose={() => setAddOpen(false)} />
    </div>
  )
}
