import {
  createTransaction as createTransactionApi,
  deleteTransaction as deleteTransactionApi,
  getTransactions,
  updateTransaction as updateTransactionApi,
  voidTransaction as voidTransactionApi,
} from '@/services/googleSheetsApi'
import { normalizeTransactions } from '@/lib/transactionAdapter'
import { useDeleteAction, useRemoteList, useSyncedAction } from './useRemoteData'
import type { RawTransaction, Transaction, TransactionUpdateInput } from '@/types'

export interface UseTransactionsResult {
  transactions: Transaction[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
  createTransaction: (input: TransactionUpdateInput) => Promise<void>
  creating: boolean
  voidTransaction: (sourceId: string) => Promise<void>
  voiding: boolean
  updateTransaction: (sourceId: string, input: Partial<TransactionUpdateInput>) => Promise<void>
  updating: boolean
  deleteTransaction: (sourceId: string) => Promise<void>
  deleting: boolean
}

function transformRows(rows: RawTransaction[]): Transaction[] {
  return normalizeTransactions(rows, (row, reason) => {
    if (import.meta.env.DEV) console.warn('[useTransactions] Skipped a row:', reason, row)
  })
}

/**
 * Fetches every transaction from the Google Sheets API once, exposing it as the single
 * shared source Dashboard/Finance/Assistant all derive their numbers from — per the
 * "Google Sheets → API service → this hook → pages" data flow.
 */
export function useTransactions(): UseTransactionsResult {
  const { items, loading, refreshing, error, refetch } = useRemoteList('transactions', getTransactions, transformRows, 'Failed to load transactions.')
  const [createTransaction, creating] = useSyncedAction((input: TransactionUpdateInput) => createTransactionApi({ ...input }), refetch)
  const [voidTransaction, voiding] = useSyncedAction((sourceId: string) => voidTransactionApi(sourceId), refetch)
  const [updateTransaction, updating] = useSyncedAction(
    (sourceId: string, input: Partial<TransactionUpdateInput>) => updateTransactionApi(sourceId, { ...input }),
    refetch,
  )
  const [deleteTransaction, deleting] = useDeleteAction('transactions', 'id', deleteTransactionApi, refetch)

  return { transactions: items, loading, refreshing, error, refetch, createTransaction, creating, voidTransaction, voiding, updateTransaction, updating, deleteTransaction, deleting }
}
