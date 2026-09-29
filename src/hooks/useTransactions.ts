import { getTransactions, voidTransaction as voidTransactionApi } from '@/services/googleSheetsApi'
import { normalizeTransactions } from '@/lib/transactionAdapter'
import { useRemoteList, useSyncedAction } from './useRemoteData'
import type { Transaction } from '@/types'
import type { RawTransaction } from '@/types/googleSheets'

export interface UseTransactionsResult {
  transactions: Transaction[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
  voidTransaction: (sourceId: string) => Promise<void>
  voiding: boolean
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
  const { items, loading, refreshing, error, refetch } = useRemoteList(getTransactions, transformRows, 'Failed to load transactions.')
  const [voidTransaction, voiding] = useSyncedAction((sourceId: string) => voidTransactionApi(sourceId), refetch)

  return { transactions: items, loading, refreshing, error, refetch, voidTransaction, voiding }
}
