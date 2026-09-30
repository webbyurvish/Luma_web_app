import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TransactionsFilters } from '@/components/transactions/TransactionsFilters'
import { TransactionsTable } from '@/components/transactions/TransactionsTable'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListRowSkeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBar } from '@/components/ui/Loader'
import { getErrorMessage } from '@/lib/errors'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { TransactionEditor } from '@/components/transactions/TransactionEditor'
import { QuickAddBar } from '@/components/ai/QuickAddBar'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useFinanceCollections'
import { getRecentTransactions } from '@/lib/transactionCalculations'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/formatCurrency'
import type { Transaction, TransactionType, TransactionUpdateInput } from '@/types'

const PAGE_SIZE = 8

export function Transactions() {
  const { showToast } = useToast()
  const { transactions, loading, refreshing, error, refetch, createTransaction, creating, voidTransaction, voiding, updateTransaction, updating, deleteTransaction, deleting } = useTransactions()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TransactionType | 'all'>('all')
  const [category, setCategory] = useState('all')
  const { accounts } = useAccounts()
  // "View transactions" on an account lands here pre-filtered to it.
  const location = useLocation()
  const [account, setAccount] = useState<string>(() => (location.state as { accountId?: string } | null)?.accountId ?? 'all')
  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null)
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

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

  const handleCreate = async (input: Partial<TransactionUpdateInput>) => {
    try {
      await createTransaction(input as TransactionUpdateInput)
      showToast(`${input.type ?? 'Transaction'} added`)
      setAddOpen(false)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't add the transaction. Please try again."), 'error')
    }
  }

  const handleEditSave = async (input: Partial<TransactionUpdateInput>) => {
    if (!editTarget?.sourceId) return
    try {
      await updateTransaction(editTarget.sourceId, input)
      showToast('Transaction updated')
      setEditTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the transaction. Please try again."), 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.sourceId) return
    try {
      await deleteTransaction(deleteTarget.sourceId)
      showToast('Transaction deleted')
      setDeleteTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't delete the transaction. Please try again."), 'error')
    }
  }

  const filtered = useMemo(() => {
    return getRecentTransactions(transactions, transactions.length).filter((item) => {
      const query = search.toLowerCase()
      const linked = [item.accountId, item.toAccountId].map((id) => (id ? accountNames.get(id) ?? '' : '')).join(' ').toLowerCase()
      const matchesSearch = item.description.toLowerCase().includes(query) || (!!query && linked.includes(query))
      const matchesType = type === 'all' || item.type === type
      const matchesCategory = category === 'all' || item.category === category
      const matchesAccount =
        account === 'all' || (account === 'none' ? !item.accountId : item.accountId === account || item.toAccountId === account)
      return matchesSearch && matchesType && matchesCategory && matchesAccount
    })
  }, [transactions, search, type, category, account, accountNames])

  return (
    <div className="flex flex-col gap-4 pt-3">
      <QuickAddBar />

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
        account={account}
        onAccountChange={(value) => {
          setAccount(value)
          setPage(1)
        }}
        accounts={accounts}
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
          <TransactionsTable transactions={filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} onVoid={setVoidTarget} onEdit={setEditTarget} onDelete={setDeleteTarget} accountNames={accountNames} />
        </div>
      )}

      <TransactionEditor
        open={addOpen}
        transaction={null}
        allTransactions={transactions}
        accounts={accounts}
        onClose={() => setAddOpen(false)}
        onSave={handleCreate}
        saving={creating}
      />

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

      <TransactionEditor
        open={editTarget !== null}
        transaction={editTarget}
        allTransactions={transactions}
        accounts={accounts}
        onClose={() => setEditTarget(null)}
        onSave={handleEditSave}
        saving={updating}
      />

      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="transaction"
        recordName={
          deleteTarget
            ? `${deleteTarget.description} · ${formatCurrency(deleteTarget.type === 'expense' ? -deleteTarget.amount : deleteTarget.amount, { signed: true })}`
            : undefined
        }
        softActionLabel="Void"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
