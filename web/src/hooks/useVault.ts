import { useSyncExternalStore } from 'react'
import { onSessionEnd } from '@/lib/auth'
import { createVaultKey, decryptText, encryptText, unlockVaultKey, type VaultMeta } from '@/lib/vaultCrypto'
import { getVault, getVaultStatus, vaultApi } from '@/services/googleSheetsApi'
import { getErrorMessage } from '@/lib/errors'
import type { RawVaultItem, VaultItem, VaultItemContent } from '@/types'

/**
 * The vault lives in this module, shared by every component: ciphertext from the script, the
 * in-memory key while unlocked, and the decrypted items. Nothing here is ever written to
 * localStorage — a reload, the idle timer or the end of the sign-in session locks it again.
 */

export type VaultPhase = 'loading' | 'error' | 'unavailable' | 'setup' | 'locked' | 'unlocked'

export interface VaultState {
  phase: VaultPhase
  error: string | null
  items: VaultItem[]
  /** Items that didn't decrypt with this key (shouldn't happen; shown as a warning). */
  unreadable: number
  refreshing: boolean
}

export const VAULT_IDLE_LOCK_MS = 5 * 60 * 1000

let state: VaultState = { phase: 'loading', error: null, items: [], unreadable: 0, refreshing: false }
let meta: VaultMeta | null = null
let raw: RawVaultItem[] = []
let key: CryptoKey | null = null
let loadPromise: Promise<void> | null = null
let loadedAt = 0
const listeners = new Set<() => void>()

function set(next: Partial<VaultState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

async function decryptAll(k: CryptoKey, rows: RawVaultItem[]): Promise<{ items: VaultItem[]; unreadable: number }> {
  let unreadable = 0
  const items = await Promise.all(
    rows.map(async (row) => {
      try {
        const content = JSON.parse(await decryptText(k, row.data)) as VaultItemContent
        return { ...content, fields: content.fields ?? {}, notes: content.notes ?? '', id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
      } catch {
        unreadable++
        return null
      }
    }),
  )
  return { items: items.filter((i): i is VaultItem => i !== null), unreadable }
}

/* ------------------------------------------------------------ auto-lock */

let lastActivity = Date.now()
let idleTimer: number | undefined
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

function markActive() {
  lastActivity = Date.now()
}

function checkIdle() {
  if (key && Date.now() - lastActivity >= VAULT_IDLE_LOCK_MS) lockVault()
}

function startIdleWatch() {
  lastActivity = Date.now()
  ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }))
  document.addEventListener('visibilitychange', checkIdle)
  window.clearInterval(idleTimer)
  idleTimer = window.setInterval(checkIdle, 10_000)
}

function stopIdleWatch() {
  ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive))
  document.removeEventListener('visibilitychange', checkIdle)
  window.clearInterval(idleTimer)
}

export function lockVault() {
  key = null
  stopIdleWatch()
  if (state.phase === 'unlocked' || state.items.length) set({ phase: meta ? 'locked' : state.phase, items: [], unreadable: 0 })
}

// Signing out (or the 2-hour session ending) forgets the key and the ciphertext.
onSessionEnd(() => {
  lockVault()
  meta = null
  raw = []
  loadedAt = 0
  loadPromise = null
  state = { phase: 'loading', error: null, items: [], unreadable: 0, refreshing: false }
  listeners.forEach((l) => l())
})

/* -------------------------------------------------------------- actions */

export function loadVault(force = false): Promise<void> {
  if (loadPromise) return loadPromise
  if (!force && loadedAt && Date.now() - loadedAt < 60_000) return Promise.resolve()
  set(loadedAt ? { refreshing: true } : { phase: 'loading', error: null })
  loadPromise = (async () => {
    try {
      const status = await getVaultStatus()
      if (!status.available) {
        set({ phase: 'unavailable', refreshing: false })
        return
      }
      const data = await getVault()
      meta = data.meta
      raw = data.items
      loadedAt = Date.now()
      if (!meta) {
        set({ phase: 'setup', refreshing: false, error: null })
      } else if (key) {
        const { items, unreadable } = await decryptAll(key, raw)
        set({ phase: 'unlocked', items, unreadable, refreshing: false, error: null })
      } else {
        set({ phase: 'locked', refreshing: false, error: null })
      }
    } catch (err) {
      if (loadedAt) set({ refreshing: false })
      else set({ phase: 'error', error: getErrorMessage(err, "Couldn't open your vault."), refreshing: false })
    } finally {
      loadPromise = null
    }
  })()
  return loadPromise
}

export async function setupVault(password: string): Promise<void> {
  const created = await createVaultKey(password)
  const saved = await vaultApi.setup(created.meta)
  meta = saved.meta
  raw = []
  key = created.key
  loadedAt = Date.now()
  startIdleWatch()
  set({ phase: 'unlocked', items: [], unreadable: 0, error: null })
}

/** False when the master password is wrong. */
export async function unlockVault(password: string): Promise<boolean> {
  if (!meta) return false
  const k = await unlockVaultKey(password, meta)
  if (!k) return false
  key = k
  const { items, unreadable } = await decryptAll(k, raw)
  startIdleWatch()
  set({ phase: 'unlocked', items, unreadable, error: null })
  // Pick up anything added from another device since the list was fetched.
  void loadVault()
  return true
}

function requireKey(): CryptoKey {
  if (!key) throw new Error('The vault is locked. Unlock it and try again.')
  return key
}

export async function saveVaultItem(content: VaultItemContent, id?: string): Promise<VaultItem> {
  const k = requireKey()
  const clean: VaultItemContent = {
    type: content.type,
    title: content.title.trim(),
    group: content.group.trim(),
    favorite: content.favorite,
    fields: Object.fromEntries(Object.entries(content.fields).map(([f, v]) => [f, v.trim()]).filter(([, v]) => v)),
    notes: content.notes.trim(),
  }
  const { item: row } = await vaultApi.save(await encryptText(k, JSON.stringify(clean)), id)
  const item: VaultItem = { ...clean, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
  raw = id ? raw.map((r) => (r.id === id ? row : r)) : [...raw, row]
  set({ items: id ? state.items.map((i) => (i.id === id ? item : i)) : [...state.items, item] })
  return item
}

export async function deleteVaultItem(id: string): Promise<void> {
  await vaultApi.remove(id)
  raw = raw.filter((r) => r.id !== id)
  set({ items: state.items.filter((i) => i.id !== id) })
}

/** Re-encrypts every item under a new master password. False when the current one is wrong. */
export async function changeMasterPassword(current: string, next: string): Promise<boolean> {
  if (!meta) return false
  const check = await unlockVaultKey(current, meta)
  if (!check) return false
  // Work from a fresh copy so nothing added elsewhere is left behind (the script refuses otherwise).
  const latest = await getVault()
  const { items, unreadable } = await decryptAll(check, latest.items)
  if (unreadable) throw new Error(`${unreadable} item(s) couldn't be read, so the password wasn't changed.`)
  const created = await createVaultKey(next)
  const reencrypted = await Promise.all(
    items.map(async (item) => {
      const content: VaultItemContent = { type: item.type, title: item.title, group: item.group, favorite: item.favorite, fields: item.fields, notes: item.notes }
      return { id: item.id, data: await encryptText(created.key, JSON.stringify(content)) }
    }),
  )
  const saved = await vaultApi.rekey(created.meta, reencrypted)
  meta = saved.meta
  key = created.key
  raw = latest.items.map((r) => ({ ...r, data: reencrypted.find((x) => x.id === r.id)!.data }))
  set({ items, unreadable: 0 })
  return true
}

/** Erases every item and the master password (for a forgotten password). */
export async function resetVault(): Promise<void> {
  await vaultApi.reset()
  lockVault()
  meta = null
  raw = []
  set({ phase: 'setup', items: [], unreadable: 0 })
}

/* ------------------------------------------------------------------ hook */

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useVault(): VaultState {
  return useSyncExternalStore(subscribe, () => state)
}
