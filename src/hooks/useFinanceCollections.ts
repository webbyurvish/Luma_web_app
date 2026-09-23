import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createAccount as createAccountApi,
  createInvestment as createInvestmentApi,
  createLiability as createLiabilityApi,
  createSip as createSipApi,
  getAccounts,
  getInvestments,
  getLiabilities,
  getSips,
} from '@/services/googleSheetsApi'
import {
  buildAccountPayload,
  buildInvestmentPayload,
  buildLiabilityPayload,
  buildSipPayload,
  normalizeAccount,
  normalizeInvestment,
  normalizeLiability,
  normalizeSip,
} from '@/lib/financeAdapters'
import type { AccountInput, FinancialAccount, Investment, InvestmentInput, Liability, LiabilityInput, SIP, SIPInput } from '@/types'

interface RemoteCollectionResult<T> {
  items: T[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetch-on-mount + refetch, mirroring useTransactions(). Read-only here — creation is
 * layered on top per entity since each has its own payload shape.
 */
function useRemoteCollection<TRaw, T>(fetchFn: (signal?: AbortSignal) => Promise<TRaw[]>, normalize: (raw: TRaw) => T): RemoteCollectionResult<T> {
  const [items, setItems] = useState<T[]>([])
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

    fetchFn(controller.signal)
      .then((rows) => {
        if (!mountedRef.current) return
        setItems(rows.map(normalize))
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!mountedRef.current) return
        const message = err instanceof Error ? err.message : 'Failed to load data.'
        if (import.meta.env.DEV) console.error('[useRemoteCollection] Fetch failed:', err)
        setError(message)
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })

    return () => controller.abort()
    // fetchFn/normalize are stable module-level function references passed in by each
    // entity-specific wrapper below — they never change identity, so omitting them from
    // the dep array wouldn't cause a stale closure, but including them keeps the rule happy.
  }, [version, fetchFn, normalize])

  const refetch = useCallback(() => setVersion((v) => v + 1), [])
  return { items, loading, error, refetch }
}

export interface UseAccountsResult {
  accounts: FinancialAccount[]
  loading: boolean
  error: string | null
  refetch: () => void
  createAccount: (input: AccountInput) => Promise<void>
  creating: boolean
}

export function useAccounts(): UseAccountsResult {
  const { items, loading, error, refetch } = useRemoteCollection(getAccounts, normalizeAccount)
  const [creating, setCreating] = useState(false)

  const createAccount = useCallback(
    async (input: AccountInput) => {
      setCreating(true)
      try {
        await createAccountApi(buildAccountPayload(input))
        refetch()
      } finally {
        setCreating(false)
      }
    },
    [refetch],
  )

  return { accounts: items, loading, error, refetch, createAccount, creating }
}

export interface UseInvestmentsResult {
  investments: Investment[]
  loading: boolean
  error: string | null
  refetch: () => void
  createInvestment: (input: InvestmentInput) => Promise<void>
  creating: boolean
}

export function useInvestments(): UseInvestmentsResult {
  const { items, loading, error, refetch } = useRemoteCollection(getInvestments, normalizeInvestment)
  const [creating, setCreating] = useState(false)

  const createInvestment = useCallback(
    async (input: InvestmentInput) => {
      setCreating(true)
      try {
        await createInvestmentApi(buildInvestmentPayload(input))
        refetch()
      } finally {
        setCreating(false)
      }
    },
    [refetch],
  )

  return { investments: items, loading, error, refetch, createInvestment, creating }
}

export interface UseSipsResult {
  sips: SIP[]
  loading: boolean
  error: string | null
  refetch: () => void
  createSip: (input: SIPInput) => Promise<void>
  creating: boolean
}

export function useSips(): UseSipsResult {
  const { items, loading, error, refetch } = useRemoteCollection(getSips, normalizeSip)
  const [creating, setCreating] = useState(false)

  const createSip = useCallback(
    async (input: SIPInput) => {
      setCreating(true)
      try {
        await createSipApi(buildSipPayload(input))
        refetch()
      } finally {
        setCreating(false)
      }
    },
    [refetch],
  )

  return { sips: items, loading, error, refetch, createSip, creating }
}

export interface UseLiabilitiesResult {
  liabilities: Liability[]
  loading: boolean
  error: string | null
  refetch: () => void
  createLiability: (input: LiabilityInput) => Promise<void>
  creating: boolean
}

export function useLiabilities(): UseLiabilitiesResult {
  const { items, loading, error, refetch } = useRemoteCollection(getLiabilities, normalizeLiability)
  const [creating, setCreating] = useState(false)

  const createLiability = useCallback(
    async (input: LiabilityInput) => {
      setCreating(true)
      try {
        await createLiabilityApi(buildLiabilityPayload(input))
        refetch()
      } finally {
        setCreating(false)
      }
    },
    [refetch],
  )

  return { liabilities: items, loading, error, refetch, createLiability, creating }
}
