import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ensureLoaded, getSnapshot, hasRecord, refetch as refetchKey, type RemoteKey, subscribe } from '@/lib/remoteStore'

export interface RemoteListResult<T> {
  items: T[]
  /** True only while there's nothing to show yet (no cached or fetched data) — drives skeletons. */
  loading: boolean
  /** True while re-syncing data that's already on screen (cache restore, after a save, manual refetch). */
  refreshing: boolean
  /** Only surfaced when there's no data to show; a failed background re-sync keeps the last good data. */
  error: string | null
  /** Re-fetches in the background; the promise settles once the fresh data (or an error) has landed. */
  refetch: () => Promise<void>
}

/**
 * One Sheets-backed list, read through the app-wide store in lib/remoteStore: every
 * component using the same `key` shares a single request and a single copy of the rows.
 */
export function useRemoteList<TRaw, T>(
  key: RemoteKey,
  fetchFn: () => Promise<TRaw[]>,
  transform: (rows: TRaw[]) => T[],
  fallbackError = 'Failed to load data.',
): RemoteListResult<T> {
  const snapshot = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(key, listener), [key]),
    () => getSnapshot(key),
  )

  useEffect(() => {
    void ensureLoaded(key, fetchFn, fallbackError)
  }, [key, fetchFn, fallbackError])

  const items = useMemo(() => (snapshot.raw ? transform(snapshot.raw as TRaw[]) : []), [snapshot.raw, transform])
  const hasData = snapshot.raw !== null

  const refetch = useCallback(() => refetchKey(key, fetchFn, fallbackError), [key, fetchFn, fallbackError])

  return {
    items,
    loading: !hasData && !snapshot.error,
    refreshing: hasData && snapshot.syncing,
    error: hasData ? null : snapshot.error,
    refetch,
  }
}

/**
 * Wraps a write (create/update/archive/void) so its pending flag stays on until the list has
 * re-synced — the UI keeps showing "Saving…" until the new data is actually on screen.
 */
export function useSyncedAction<A extends unknown[]>(
  action: (...args: A) => Promise<unknown>,
  refetch: () => Promise<void>,
): [run: (...args: A) => Promise<void>, pending: boolean, pendingArgs: A | null] {
  const [pendingArgs, setPendingArgs] = useState<A | null>(null)
  const actionRef = useRef(action)
  useEffect(() => {
    actionRef.current = action
  })

  const run = useCallback(
    async (...args: A) => {
      setPendingArgs(args)
      try {
        await actionRef.current(...args)
        await refetch()
      } finally {
        setPendingArgs(null)
      }
    },
    [refetch],
  )

  return [run, pendingArgs !== null, pendingArgs]
}

/**
 * Permanent delete for one collection. Apps Script POST responses often can't be read back
 * (see postEntity), so a refused delete — e.g. an account still linked to SIPs — can look
 * like success. After the re-sync this checks the record is really gone and throws if not.
 */
export function useDeleteAction(
  key: RemoteKey,
  idField: string,
  deleteFn: (id: string) => Promise<unknown>,
  refetch: () => Promise<void>,
): [run: (id: string) => Promise<void>, pending: boolean] {
  const [run, pending] = useSyncedAction(deleteFn, refetch)
  const runAndVerify = useCallback(
    async (id: string) => {
      await run(id)
      if (hasRecord(key, idField, id)) {
        throw new Error("Couldn't delete this record — it's still in your sheet. If it's an account, delete or archive what's linked to it first.")
      }
    },
    [run, key, idField],
  )
  return [runAndVerify, pending]
}
