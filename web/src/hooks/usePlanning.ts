import { useCallback } from 'react'
import {
  createBill as createBillApi,
  createBudget as createBudgetApi,
  deleteBill as deleteBillApi,
  deleteBudget as deleteBudgetApi,
  getAccounts,
  getBills,
  getBudgets,
  getTransactions,
  payBill as payBillApi,
  updateBill as updateBillApi,
  updateBudget as updateBudgetApi,
} from '@/services/googleSheetsApi'
import { refetch as refetchKey } from '@/lib/remoteStore'
import { buildBillPayload, buildBudgetPayload, normalizeBill, normalizeBudget } from '@/lib/planning'
import { useRemoteCollection } from './useFinanceCollections'
import { useDeleteAction, useSyncedAction } from './useRemoteData'
import type { BillInput, BudgetInput } from '@/types'

export function useBills() {
  const { items: bills, loading, refreshing, error, refetch } = useRemoteCollection('bills', getBills, normalizeBill)
  const [createBill, creating] = useSyncedAction((input: BillInput) => createBillApi(buildBillPayload(input)), refetch)
  const [updateBill, updating] = useSyncedAction((id: string, input: Partial<BillInput>) => updateBillApi(id, buildBillPayload(input)), refetch)
  const [deleteBill, deleting] = useDeleteAction('bills', 'billId', deleteBillApi, refetch)

  // Paying records an expense and moves the linked account, so all three lists re-sync.
  const resyncAfterPay = useCallback(async () => {
    await Promise.all([
      refetch(),
      refetchKey('transactions', getTransactions, 'Failed to load transactions.'),
      refetchKey('accounts', getAccounts, "Couldn't load your accounts."),
    ])
  }, [refetch])
  const [payBill, paying, payingArgs] = useSyncedAction(
    (id: string, details: { dueDate: string; amount: number; date: string; accountId?: string; paymentMethod?: string }) => payBillApi(id, details),
    resyncAfterPay,
  )

  return {
    bills,
    loading,
    refreshing,
    error,
    refetch,
    createBill,
    creating,
    updateBill,
    updating,
    deleteBill,
    deleting,
    payBill,
    paying,
    payingId: payingArgs?.[0] ?? null,
  }
}

export function useBudgets() {
  const { items: budgets, loading, refreshing, error, refetch } = useRemoteCollection('budgets', getBudgets, normalizeBudget)
  const [createBudget, creating] = useSyncedAction((input: BudgetInput) => createBudgetApi(buildBudgetPayload(input)), refetch)
  const [updateBudget, updating] = useSyncedAction((id: string, input: Partial<BudgetInput>) => updateBudgetApi(id, buildBudgetPayload(input)), refetch)
  const [deleteBudget, deleting] = useDeleteAction('budgets', 'budgetId', deleteBudgetApi, refetch)
  return { budgets, loading, refreshing, error, refetch, createBudget, creating, updateBudget, updating, deleteBudget, deleting }
}
