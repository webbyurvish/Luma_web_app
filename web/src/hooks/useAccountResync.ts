import { useCallback } from 'react'
import { refetch as refetchKey } from '@/lib/remoteStore'
import { getAccounts } from '@/services/googleSheetsApi'

/**
 * Wraps a collection's refetch so account balances re-sync alongside it. Transactions and udhaar
 * entries can be linked to an account, and the script moves that account's balance when they
 * change — so after any such write both lists are refreshed together.
 */
export function useWithAccountResync(refetch: () => Promise<void>): () => Promise<void> {
  return useCallback(async () => {
    await Promise.all([refetch(), refetchKey('accounts', getAccounts, "Couldn't load your accounts.")])
  }, [refetch])
}
