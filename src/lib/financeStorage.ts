import { mockAccounts } from '@/data/mockAccounts'
import { mockInvestments } from '@/data/mockInvestments'
import { mockSips } from '@/data/mockSips'
import { mockLiabilities } from '@/data/mockLiabilities'
import type { FinancialAccount, Investment, SIP, Liability } from '@/types'

interface LocalStore<T> {
  load: () => T[]
  save: (items: T[]) => void
}

/**
 * A tiny localStorage-backed collection store. Seeds from mock data on first
 * load and persists that seed so subsequent loads are consistent. Swapping
 * this for a real API later only means changing what `load`/`save` do —
 * every hook and page that consumes a store stays the same.
 */
function createLocalStore<T>(key: string, seed: T[]): LocalStore<T> {
  function load(): T[] {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed as T[]
      }
    } catch {
      // fall through to seed
    }
    save(seed)
    return seed
  }

  function save(items: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(items))
    } catch {
      // localStorage unavailable — state still works for this session
    }
  }

  return { load, save }
}

export const accountStore = createLocalStore<FinancialAccount>('luma_accounts', mockAccounts)
export const investmentStore = createLocalStore<Investment>('luma_investments', mockInvestments)
export const sipStore = createLocalStore<SIP>('luma_sips', mockSips)
export const liabilityStore = createLocalStore<Liability>('luma_liabilities', mockLiabilities)
