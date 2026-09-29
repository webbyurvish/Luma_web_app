import { getBootstrap } from '@/services/googleSheetsApi'

/**
 * App-wide cache for the Sheets-backed collections, one entry per API action.
 *
 * Why this exists: Apps Script is slow to start and queues parallel executions, so
 * the cost is the *number* of requests, not their size. This store makes sure that
 *  - every component asking for the same collection shares one request
 *    (and React StrictMode's double mount doesn't fire — and cancel — a second),
 *  - the first paint comes from a single `?action=bootstrap` request when the
 *    deployed script supports it, falling back to per-collection routes if not,
 *  - the last good data is restored from localStorage immediately, so a revisit
 *    renders at once and only the background re-sync is waited on.
 */

export type RemoteKey = 'accounts' | 'investments' | 'sips' | 'liabilities' | 'transactions' | 'notes' | 'udhaar' | 'tasks' | 'documents'

export interface EntrySnapshot {
  /** Raw API rows, or null until something (cache or network) has provided them. */
  raw: unknown[] | null
  /** A request is in flight for this key. */
  syncing: boolean
  /** Last network error; cleared by the next successful fetch. */
  error: string | null
}

interface Entry {
  snapshot: EntrySnapshot
  listeners: Set<() => void>
  /** True once this session has data from the network (cached data doesn't count). */
  fresh: boolean
  /** When the network data landed; past FRESH_FOR_MS a new mount re-syncs in the background. */
  fetchedAt: number
  inflight: Promise<void> | null
  /** Bumped per fetch so an older response can never overwrite a newer one. */
  generation: number
}

type BootstrapKey = 'accounts' | 'investments' | 'sips' | 'liabilities' | 'transactions' | 'udhaar'
const BOOTSTRAP_KEYS: BootstrapKey[] = ['accounts', 'investments', 'sips', 'liabilities', 'transactions', 'udhaar']
const CACHE_PREFIX = 'luma:cache:v1:'
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
/** Data younger than this is reused as-is when another page mounts; older data is re-synced in the background. */
const FRESH_FOR_MS = 60 * 1000

const entries = new Map<RemoteKey, Entry>()

function readCache(key: RemoteKey): unknown[] | null {
  try {
    const stored = localStorage.getItem(CACHE_PREFIX + key)
    if (!stored) return null
    const parsed = JSON.parse(stored) as { savedAt: number; raw: unknown[] }
    if (!Array.isArray(parsed.raw) || Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return null
    return parsed.raw
  } catch {
    return null
  }
}

function writeCache(key: RemoteKey, raw: unknown[]) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt: Date.now(), raw }))
  } catch {
    // Storage full or blocked (private mode) — the cache is only a head start, so skip it.
  }
}

function getEntry(key: RemoteKey): Entry {
  let entry = entries.get(key)
  if (!entry) {
    entry = {
      snapshot: { raw: readCache(key), syncing: false, error: null },
      listeners: new Set(),
      fresh: false,
      fetchedAt: 0,
      inflight: null,
      generation: 0,
    }
    entries.set(key, entry)
  }
  return entry
}

function update(entry: Entry, patch: Partial<EntrySnapshot>) {
  entry.snapshot = { ...entry.snapshot, ...patch }
  entry.listeners.forEach((listener) => listener())
}

function acceptRows(key: RemoteKey, entry: Entry, raw: unknown[]) {
  entry.fresh = true
  entry.fetchedAt = Date.now()
  update(entry, { raw, error: null })
  writeCache(key, raw)
}

export function subscribe(key: RemoteKey, listener: () => void): () => void {
  const entry = getEntry(key)
  entry.listeners.add(listener)
  return () => entry.listeners.delete(listener)
}

export function getSnapshot(key: RemoteKey): EntrySnapshot {
  return getEntry(key).snapshot
}

/* ---------------------------------------------------------------- bootstrap */

let bootstrapPromise: Promise<void> | null = null

// A deployment without the route costs one wasted cold start before the fallback kicks in,
// so remember "unsupported" for a while — then try again, which picks up a redeploy on its own.
const BOOTSTRAP_UNSUPPORTED_KEY = 'luma:bootstrap-unsupported-until'
const BOOTSTRAP_RETRY_AFTER_MS = 30 * 60 * 1000

function bootstrapSkipped(): boolean {
  try {
    return Number(localStorage.getItem(BOOTSTRAP_UNSUPPORTED_KEY)) > Date.now()
  } catch {
    return false
  }
}

/** Fires `?action=bootstrap` once per session, seeding every collection it returns. */
function bootstrapOnce(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise
  if (bootstrapSkipped()) return (bootstrapPromise = Promise.resolve())

  const generations = new Map(BOOTSTRAP_KEYS.map((key) => [key, getEntry(key).generation]))
  bootstrapPromise = getBootstrap()
    .then((data) => {
      BOOTSTRAP_KEYS.forEach((key) => {
        const rows = data[key]
        const entry = getEntry(key)
        // Skip keys a targeted refetch has already superseded, or that failed server-side.
        if (Array.isArray(rows) && entry.generation === generations.get(key)) acceptRows(key, entry, rows)
      })
    })
    .catch((err: unknown) => {
      // Per-collection fetches take over either way; only an older deployment is worth remembering.
      if (err instanceof Error && err.message.includes('Unknown action')) {
        try {
          localStorage.setItem(BOOTSTRAP_UNSUPPORTED_KEY, String(Date.now() + BOOTSTRAP_RETRY_AFTER_MS))
        } catch {
          // Storage blocked — we'll just try bootstrap again next load.
        }
      }
      if (import.meta.env.DEV) console.info('[remoteStore] Bootstrap unavailable, using per-collection routes:', err)
    })
  return bootstrapPromise
}

/* ---------------------------------------------------------------- fetching */

function runFetch(key: RemoteKey, fetchFn: () => Promise<unknown[]>, fallbackError: string): Promise<void> {
  const entry = getEntry(key)
  const generation = ++entry.generation
  update(entry, { syncing: true, error: null })

  const promise = fetchFn()
    .then((raw) => {
      if (generation === entry.generation) acceptRows(key, entry, raw)
    })
    .catch((err: unknown) => {
      if (generation !== entry.generation) return
      if (import.meta.env.DEV) console.error(`[remoteStore] Fetch failed for ${key}:`, err)
      update(entry, { error: err instanceof Error ? err.message : fallbackError })
    })
    .finally(() => {
      if (generation !== entry.generation) return
      entry.inflight = null
      update(entry, { syncing: false })
    })

  entry.inflight = promise
  return promise
}

/**
 * Makes sure `key` has network data this session. Shared by every component that
 * mounts for it: at most one request is ever in flight per key.
 */
export function ensureLoaded(key: RemoteKey, fetchFn: () => Promise<unknown[]>, fallbackError: string): Promise<void> {
  const entry = getEntry(key)
  if (entry.inflight) return entry.inflight
  if (entry.fresh) {
    // Stale-while-revalidate: what's on screen stays, the SyncBar shows the re-sync.
    return Date.now() - entry.fetchedAt < FRESH_FOR_MS ? Promise.resolve() : runFetch(key, fetchFn, fallbackError)
  }

  if ((BOOTSTRAP_KEYS as RemoteKey[]).includes(key)) {
    const generation = entry.generation
    update(entry, { syncing: true })
    const promise: Promise<void> = bootstrapOnce().then((): Promise<void> | void => {
      if (entry.fresh) {
        entry.inflight = null
        update(entry, { syncing: false })
        return
      }
      // A refetch started meanwhile owns this key now; wait on that instead.
      if (entry.generation !== generation && entry.inflight && entry.inflight !== promise) return entry.inflight
      return runFetch(key, fetchFn, fallbackError)
    })
    entry.inflight = promise
    return promise
  }

  return runFetch(key, fetchFn, fallbackError)
}

/**
 * Always starts a new request (used after a write, whose result an older in-flight
 * request might not include). Resolves once the fresh rows — or an error — have landed.
 */
export function refetch(key: RemoteKey, fetchFn: () => Promise<unknown[]>, fallbackError: string): Promise<void> {
  return runFetch(key, fetchFn, fallbackError)
}

/** Whether the current rows for `key` still contain a record whose `idField` equals `id`. */
export function hasRecord(key: RemoteKey, idField: string, id: string): boolean {
  const raw = getEntry(key).snapshot.raw as Record<string, unknown>[] | null
  return !!raw?.some((row) => String(row[idField] ?? '').trim() === id)
}
