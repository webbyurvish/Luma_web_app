import { useCallback, useEffect, useRef, useState } from 'react'
import { getTransactions } from '@/services/googleSheetsApi'
import { normalizeTransactions } from '@/lib/transactionAdapter'
import type { Transaction } from '@/types'

export interface UseTransactionsResult {
  transactions: Transaction[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches every transaction from the Google Sheets API once, exposing it as the single
 * shared source Dashboard/Finance/Assistant all derive their numbers from — per the
 * "Google Sheets → API service → this hook → pages" data flow.
 */
export function useTransactions(): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    getTransactions(controller.signal)
      .then((rows) => {
        if (!mountedRef.current) return
        const normalized = normalizeTransactions(rows, (row, reason) => {
          if (import.meta.env.DEV) console.warn('[useTransactions] Skipped a row:', reason, row)
        })
        setTransactions(normalized)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!mountedRef.current) return
        const message = err instanceof Error ? err.message : 'Failed to load transactions.'
        if (import.meta.env.DEV) console.error('[useTransactions] Fetch failed:', err)
        setError(message)
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })

    return () => controller.abort()
  }, [version])

  const refetch = useCallback(() => setVersion((v) => v + 1), [])

  return { transactions, loading, error, refetch }
}
