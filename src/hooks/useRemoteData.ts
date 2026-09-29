import { useCallback, useEffect, useRef, useState } from 'react'

export interface RemoteListResult<T> {
  items: T[]
  /** True only until the first successful load — drives skeletons. */
  loading: boolean
  /** True while re-syncing data that's already on screen (after a save, or a manual refetch). */
  refreshing: boolean
  error: string | null
  /** Re-fetches in the background; the promise settles once the fresh data (or an error) has landed. */
  refetch: () => Promise<void>
}

/**
 * Fetch-on-mount + refetch for one Sheets-backed list. After the first load, refetches keep
 * the current items on screen and flip `refreshing` instead of `loading`, so a save doesn't
 * blank the list back to a skeleton.
 */
export function useRemoteList<TRaw, T>(
  fetchFn: (signal?: AbortSignal) => Promise<TRaw[]>,
  transform: (rows: TRaw[]) => T[],
  fallbackError = 'Failed to load data.',
): RemoteListResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const hasLoadedRef = useRef(false)
  // Resolvers for refetch() promises, settled by whichever fetch finishes next (a superseded
  // fetch is aborted and leaves them for its replacement).
  const waitersRef = useRef<Array<() => void>>([])

  useEffect(() => {
    const controller = new AbortController()
    if (hasLoadedRef.current) setRefreshing(true)
    else setLoading(true)
    setError(null)

    fetchFn(controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return
        setItems(transform(rows))
        hasLoadedRef.current = true
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        if (import.meta.env.DEV) console.error('[useRemoteList] Fetch failed:', err)
        setError(err instanceof Error ? err.message : fallbackError)
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
        setRefreshing(false)
        const waiters = waitersRef.current
        waitersRef.current = []
        waiters.forEach((resolve) => resolve())
      })

    return () => controller.abort()
  }, [version, fetchFn, transform, fallbackError])

  const refetch = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waitersRef.current.push(resolve)
        setVersion((v) => v + 1)
      }),
    [],
  )

  return { items, loading, refreshing, error, refetch }
}

/**
 * Wraps a write (create/update/archive/void) so its pending flag stays on until the list has
 * re-synced — the UI keeps showing "Saving…" until the new data is actually on screen.
 */
export function useSyncedAction<A extends unknown[]>(
  action: (...args: A) => Promise<unknown>,
  refetch: () => Promise<void>,
): [run: (...args: A) => Promise<void>, pending: boolean] {
  const [pending, setPending] = useState(false)
  const actionRef = useRef(action)
  useEffect(() => {
    actionRef.current = action
  })

  const run = useCallback(
    async (...args: A) => {
      setPending(true)
      try {
        await actionRef.current(...args)
        await refetch()
      } finally {
        setPending(false)
      }
    },
    [refetch],
  )

  return [run, pending]
}
