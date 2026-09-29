import { useCallback } from 'react'
import {
  archiveAccount as archiveAccountApi,
  deleteAccount as deleteAccountApi,
  deleteInvestment as deleteInvestmentApi,
  deleteLiability as deleteLiabilityApi,
  deleteSip as deleteSipApi,
  archiveInvestment as archiveInvestmentApi,
  closeLiability as closeLiabilityApi,
  createAccount as createAccountApi,
  createInvestment as createInvestmentApi,
  createLiability as createLiabilityApi,
  createSip as createSipApi,
  deactivateSip as deactivateSipApi,
  getAccounts,
  getInvestments,
  getLiabilities,
  getSips,
  updateAccount as updateAccountApi,
  updateInvestment as updateInvestmentApi,
  updateLiability as updateLiabilityApi,
  updateSip as updateSipApi,
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
import { type RemoteListResult, useDeleteAction, useRemoteList, useSyncedAction } from './useRemoteData'
import type { RemoteKey } from '@/lib/remoteStore'
import type { AccountInput, FinancialAccount, Investment, InvestmentInput, Liability, LiabilityInput, SIP, SIPInput } from '@/types'

/** Per-row flavour of useRemoteList — each raw row is normalized independently. */
export function useRemoteCollection<TRaw, T>(
  key: RemoteKey,
  fetchFn: () => Promise<TRaw[]>,
  normalize: (raw: TRaw) => T,
): RemoteListResult<T> {
  // normalize is a stable module-level function, so this keeps a stable identity too.
  const transform = useCallback((rows: TRaw[]) => rows.map(normalize), [normalize])
  return useRemoteList(key, fetchFn, transform)
}

export interface UseAccountsResult {
  accounts: FinancialAccount[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
  createAccount: (input: AccountInput) => Promise<void>
  creating: boolean
  updateAccount: (id: string, input: AccountInput) => Promise<void>
  updating: boolean
  archiveAccount: (id: string) => Promise<void>
  archiving: boolean
  deleteAccount: (id: string) => Promise<void>
  deleting: boolean
}

export function useAccounts(): UseAccountsResult {
  const { items, loading, refreshing, error, refetch } = useRemoteCollection('accounts', getAccounts, normalizeAccount)
  const [createAccount, creating] = useSyncedAction((input: AccountInput) => createAccountApi(buildAccountPayload(input)), refetch)
  const [updateAccount, updating] = useSyncedAction(
    (id: string, input: AccountInput) => updateAccountApi(id, buildAccountPayload(input)),
    refetch,
  )
  const [archiveAccount, archiving] = useSyncedAction((id: string) => archiveAccountApi(id), refetch)
  const [deleteAccount, deleting] = useDeleteAction('accounts', 'accountId', deleteAccountApi, refetch)

  return { accounts: items, loading, refreshing, error, refetch, createAccount, creating, updateAccount, updating, archiveAccount, archiving, deleteAccount, deleting }
}

export interface UseInvestmentsResult {
  investments: Investment[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
  createInvestment: (input: InvestmentInput) => Promise<void>
  creating: boolean
  updateInvestment: (id: string, input: InvestmentInput) => Promise<void>
  updating: boolean
  archiveInvestment: (id: string) => Promise<void>
  archiving: boolean
  deleteInvestment: (id: string) => Promise<void>
  deleting: boolean
}

export function useInvestments(): UseInvestmentsResult {
  const { items, loading, refreshing, error, refetch } = useRemoteCollection('investments', getInvestments, normalizeInvestment)
  const [createInvestment, creating] = useSyncedAction(
    (input: InvestmentInput) => createInvestmentApi(buildInvestmentPayload(input)),
    refetch,
  )
  const [updateInvestment, updating] = useSyncedAction(
    (id: string, input: InvestmentInput) => updateInvestmentApi(id, buildInvestmentPayload(input)),
    refetch,
  )
  const [archiveInvestment, archiving] = useSyncedAction((id: string) => archiveInvestmentApi(id), refetch)
  const [deleteInvestment, deleting] = useDeleteAction('investments', 'investmentId', deleteInvestmentApi, refetch)

  return {
    investments: items,
    loading,
    refreshing,
    error,
    refetch,
    createInvestment,
    creating,
    updateInvestment,
    updating,
    archiveInvestment,
    archiving,
    deleteInvestment,
    deleting,
  }
}

export interface UseSipsResult {
  sips: SIP[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
  createSip: (input: SIPInput) => Promise<void>
  creating: boolean
  updateSip: (id: string, input: SIPInput) => Promise<void>
  updating: boolean
  deactivateSip: (id: string) => Promise<void>
  deactivating: boolean
  deleteSip: (id: string) => Promise<void>
  deleting: boolean
}

export function useSips(): UseSipsResult {
  const { items, loading, refreshing, error, refetch } = useRemoteCollection('sips', getSips, normalizeSip)
  const [createSip, creating] = useSyncedAction((input: SIPInput) => createSipApi(buildSipPayload(input)), refetch)
  const [updateSip, updating] = useSyncedAction((id: string, input: SIPInput) => updateSipApi(id, buildSipPayload(input)), refetch)
  const [deactivateSip, deactivating] = useSyncedAction((id: string) => deactivateSipApi(id), refetch)
  const [deleteSip, deleting] = useDeleteAction('sips', 'sipId', deleteSipApi, refetch)

  return { sips: items, loading, refreshing, error, refetch, createSip, creating, updateSip, updating, deactivateSip, deactivating, deleteSip, deleting }
}

export interface UseLiabilitiesResult {
  liabilities: Liability[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
  createLiability: (input: LiabilityInput) => Promise<void>
  creating: boolean
  updateLiability: (id: string, input: LiabilityInput) => Promise<void>
  updating: boolean
  closeLiability: (id: string) => Promise<void>
  closing: boolean
  deleteLiability: (id: string) => Promise<void>
  deleting: boolean
}

export function useLiabilities(): UseLiabilitiesResult {
  const { items, loading, refreshing, error, refetch } = useRemoteCollection('liabilities', getLiabilities, normalizeLiability)
  const [createLiability, creating] = useSyncedAction(
    (input: LiabilityInput) => createLiabilityApi(buildLiabilityPayload(input)),
    refetch,
  )
  const [updateLiability, updating] = useSyncedAction(
    (id: string, input: LiabilityInput) => updateLiabilityApi(id, buildLiabilityPayload(input)),
    refetch,
  )
  const [closeLiability, closing] = useSyncedAction((id: string) => closeLiabilityApi(id), refetch)
  const [deleteLiability, deleting] = useDeleteAction('liabilities', 'liabilityId', deleteLiabilityApi, refetch)

  return { liabilities: items, loading, refreshing, error, refetch, createLiability, creating, updateLiability, updating, closeLiability, closing, deleteLiability, deleting }
}
