import { useCallback, useEffect, useState } from 'react'
import { accountStore, investmentStore, liabilityStore, sipStore } from '@/lib/financeStorage'
import type { AccountInput, FinancialAccount, Investment, InvestmentInput, Liability, LiabilityInput, SIP, SIPInput } from '@/types'

interface Entity {
  id: string
  createdAt: string
  updatedAt: string
}

interface CollectionStore<T> {
  load: () => T[]
  save: (items: T[]) => void
}

function useCollection<T extends Entity, TInput>(store: CollectionStore<T>, buildNew: (input: TInput, id: string, now: string) => T) {
  const [items, setItems] = useState<T[]>(() => store.load())

  useEffect(() => {
    store.save(items)
  }, [items, store])

  const create = useCallback(
    (input: TInput): T => {
      const now = new Date().toISOString()
      const entity = buildNew(input, crypto.randomUUID(), now)
      setItems((prev) => [entity, ...prev])
      return entity
    },
    [buildNew],
  )

  const update = useCallback((id: string, patch: Partial<T>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)))
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return { items, create, update, remove }
}

export function useAccounts() {
  const { items, create, update, remove } = useCollection<FinancialAccount, AccountInput>(accountStore, (input, id, now) => ({
    id,
    ...input,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }))
  return { accounts: items, createAccount: create, updateAccount: update, deleteAccount: remove }
}

export function useInvestments() {
  const { items, create, update, remove } = useCollection<Investment, InvestmentInput>(investmentStore, (input, id, now) => ({
    id,
    ...input,
    createdAt: now,
    updatedAt: now,
  }))
  return { investments: items, createInvestment: create, updateInvestment: update, deleteInvestment: remove }
}

export function useSips() {
  const { items, create, update, remove } = useCollection<SIP, SIPInput>(sipStore, (input, id, now) => ({
    id,
    ...input,
    createdAt: now,
    updatedAt: now,
  }))
  return { sips: items, createSip: create, updateSip: update, deleteSip: remove }
}

export function useLiabilities() {
  const { items, create, update, remove } = useCollection<Liability, LiabilityInput>(liabilityStore, (input, id, now) => ({
    id,
    ...input,
    createdAt: now,
    updatedAt: now,
  }))
  return { liabilities: items, createLiability: create, updateLiability: update, deleteLiability: remove }
}
