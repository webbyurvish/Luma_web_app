import { useMemo, useState } from 'react'
import { TransactionsFilters } from '@/components/transactions/TransactionsFilters'
import { TransactionsTable } from '@/components/transactions/TransactionsTable'
import { QuickActionModal } from '@/components/common/QuickActionModal'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListRowSkeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBar } from '@/components/ui/Loader'
import { getErrorMessage } from '@/lib/errors'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTransactions } from '@/hooks/useTransactions'
import { getRecentTransactions } from '@/lib/transactionCalculations'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/formatCurrency'
import type { Transaction, TransactionType } from '@/types'

const PAGE_SIZE = 8

export function Transactions() {
  const { showToast } = useToast()
  const { transactions, loading, refreshing, error, refetch, voidTransaction, voiding } = useTransactions()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TransactionType | 'all'>('all')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null)

  const handleVoidConfirm = async () => {
    if (!voidTarget?.sourceId) return
    try {
      await voidTransaction(voidTarget.sourceId)
      showToast('Transaction voided')
      setVoidTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't void the transaction. Please try again."), 'error')
    }
  }

  const filtered = useMemo(() => {
    return getRecentTransactions(transactions, transactions.length).filter((item) => {
      const matchesSearch = item.description.toLowerCase().includes(search.toLowerCase())
      const matchesType = type === 'all' || item.type === type
      const matchesCategory = category === 'all' || item.category === category
      return matchesSearch && matchesType && matchesCategory
    })
  }, [transactions, search, type, category])

  return (
    <div className="flex flex-col gap-4 pt-3">
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

      {error ? (
        <ErrorState title="Couldn't load your transactions." description={error} onRetry={refetch} />
      ) : loading ? (
        <Card>
          <div className="divide-y divide-border-soft">
            {Array.from({ length: 6 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
          <SlowLoadHint message="Fetching your transactions…" />
        </Card>
      ) : (
        <div className="relative">
          <SyncBar active={refreshing} />
          <TransactionsTable transactions={filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} onVoid={setVoidTarget} />
        </div>
      )}

      <QuickActionModal open={addOpen} kind="expense" onClose={() => setAddOpen(false)} />

      <ConfirmDialog
        open={voidTarget !== null}
        title="Void this transaction?"
        description={`"${voidTarget?.description}" (${voidTarget ? formatCurrency(voidTarget.type === 'expense' ? -voidTarget.amount : voidTarget.amount, { signed: true }) : ''}) will be excluded from every total and chart, but stays in the sheet for audit. This can't be undone from here.`}
        confirmLabel="Void"
        loading={voiding}
        loadingLabel="Voiding…"
        onConfirm={handleVoidConfirm}
        onCancel={() => setVoidTarget(null)}
      />
    </div>
  )
}
