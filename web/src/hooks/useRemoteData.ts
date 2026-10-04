import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ensureLoaded, getSnapshot, hasRecord, mutateLocal, refetch as refetchKey, type RemoteKey, subscribe } from '@/lib/remoteStore'
import { isConfirmedSave } from '@/services/googleSheetsApi'

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
 * Wraps a write (create/update/archive/void). When the script confirms the save, the action
 * finishes right away and the list re-syncs in the background (the SyncBar shows it) — no second
 * wait. When the reply couldn't be read, "Saving…" stays on until the re-sync shows the new data.
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
        const result = await actionRef.current(...args)
        if (isConfirmedSave(result)) void refetch()
        else await refetch()
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
  const [pending, setPending] = useState(false)
  const deleteRef = useRef(deleteFn)
  useEffect(() => {
    deleteRef.current = deleteFn
  })
  const runAndVerify = useCallback(
    async (id: string) => {
      setPending(true)
      try {
        const result = await deleteRef.current(id)
        if (isConfirmedSave(result)) {
          // The script confirmed it: take the row off screen now, re-sync quietly.
          mutateLocal(key, (rows) => rows.filter((row) => String((row as Record<string, unknown>)[idField] ?? '').trim() !== id))
          void refetch()
          return
        }
        await refetch()
        if (hasRecord(key, idField, id)) {
          throw new Error("Couldn't delete this record — it's still in your sheet. If it's an account, delete or archive what's linked to it first.")
        }
      } finally {
        setPending(false)
      }
    },
    [key, idField, refetch],
  )
  return [runAndVerify, pending]
}
