import { useCallback } from 'react'
import {
  createImportantDate as createImportantDateApi,
  createRecharge as createRechargeApi,
  deleteImportantDate as deleteImportantDateApi,
  deleteRecharge as deleteRechargeApi,
  getAccounts,
  getImportantDates,
  getRechargeHistory,
  getRecharges,
  getTransactions,
  markRecharged as markRechargedApi,
  updateImportantDate as updateImportantDateApi,
  updateRecharge as updateRechargeApi,
} from '@/services/googleSheetsApi'
import { refetch as refetchKey } from '@/lib/remoteStore'
import { buildImportantDatePayload, buildRechargePayload, normalizeImportantDate, normalizeRecharge, normalizeRechargeLog } from '@/lib/family'
import { useRemoteCollection } from './useFinanceCollections'
import { useDeleteAction, useSyncedAction } from './useRemoteData'
import type { ImportantDateInput, RechargeInput } from '@/types'

export function useRecharges() {
  const { items: recharges, loading, refreshing, error, refetch } = useRemoteCollection('recharges', getRecharges, normalizeRecharge)
  const [createRecharge, creating] = useSyncedAction((input: RechargeInput) => createRechargeApi(buildRechargePayload(input)), refetch)
  const [updateRecharge, updating] = useSyncedAction((id: string, input: Partial<RechargeInput>) => updateRechargeApi(id, buildRechargePayload(input)), refetch)
  const [deleteRecharge, deleting] = useDeleteAction('recharges', 'rechargeId', deleteRechargeApi, refetch)

  // Recording a recharge writes history and may record an expense (moving an account).
  const resync = useCallback(async () => {
    await Promise.all([
      refetch(),
      refetchKey('rechargehistory', getRechargeHistory, "Couldn't load recharge history."),
      refetchKey('transactions', getTransactions, 'Failed to load transactions.'),
      refetchKey('accounts', getAccounts, "Couldn't load your accounts."),
    ])
  }, [refetch])
  const [markRecharged, recording] = useSyncedAction((id: string, details: Parameters<typeof markRechargedApi>[1]) => markRechargedApi(id, details), resync)

  return { recharges, loading, refreshing, error, refetch, createRecharge, creating, updateRecharge, updating, deleteRecharge, deleting, markRecharged, recording }
}

export function useRechargeHistory() {
  const { items: history, loading, error, refetch } = useRemoteCollection('rechargehistory', getRechargeHistory, normalizeRechargeLog)
  return { history, loading, error, refetch }
}

export function useImportantDates() {
  const { items: dates, loading, refreshing, error, refetch } = useRemoteCollection('importantdates', getImportantDates, normalizeImportantDate)
  const [createDate, creating] = useSyncedAction((input: ImportantDateInput) => createImportantDateApi(buildImportantDatePayload(input)), refetch)
  const [updateDate, updating] = useSyncedAction((id: string, input: Partial<ImportantDateInput>) => updateImportantDateApi(id, buildImportantDatePayload(input)), refetch)
  const [deleteDate, deleting] = useDeleteAction('importantdates', 'dateId', deleteImportantDateApi, refetch)
  return { dates, loading, refreshing, error, refetch, createDate, creating, updateDate, updating, deleteDate, deleting }
}
