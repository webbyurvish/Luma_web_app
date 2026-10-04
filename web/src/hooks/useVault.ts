import { useSyncExternalStore } from 'react'
import { onSessionEnd } from '@/lib/auth'
import {
  aadFor,
  createVaultKey,
  createVaultKeyV1,
  decryptText,
  encryptText,
  importVaultKey,
  keyMatches,
  newVaultItemId,
  unlockVaultKey,
  type VaultMeta,
} from '@/lib/vaultCrypto'
import { enrolledDevice, unwrapWithBiometric, wrapWithBiometric, type BiometricWrap } from '@/lib/deviceUnlock'
import { getVault, getVaultStatus, vaultApi } from '@/services/googleSheetsApi'
import { getErrorMessage } from '@/lib/errors'
import type { RawVaultItem, VaultItem, VaultItemContent } from '@/types'

/**
 * The vault lives in this module, shared by every component: ciphertext from the script, the
 * in-memory key while unlocked, and the decrypted items. No key or plaintext is ever written to
 * storage — a reload, the auto-lock or the end of the sign-in session locks it again. (Face ID
 * unlock stores the key only *encrypted* by a secret that needs Face ID on this device.)
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

let state: VaultState = { phase: 'loading', error: null, items: [], unreadable: 0, refreshing: false }
let meta: VaultMeta | null = null
let raw: RawVaultItem[] = []
let key: CryptoKey | null = null
let loadPromise: Promise<void> | null = null
let loadedAt = 0
/** The deployment accepts Argon2id (v2) vaults. */
let serverV2 = false
const listeners = new Set<() => void>()

function set(next: Partial<VaultState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

const contentOf = (item: VaultItem): VaultItemContent => ({ type: item.type, title: item.title, group: item.group, favorite: item.favorite, fields: item.fields, notes: item.notes })

async function decryptAll(k: CryptoKey, rows: RawVaultItem[], m: VaultMeta): Promise<{ items: VaultItem[]; unreadable: number }> {
  let unreadable = 0
  const items = await Promise.all(
    rows.map(async (row) => {
      try {
        const content = JSON.parse(await decryptText(k, row.data, aadFor(m, row.id))) as VaultItemContent
        return { ...content, fields: content.fields ?? {}, notes: content.notes ?? '', id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
      } catch {
        unreadable++
        return null
      }
    }),
  )
  return { items: items.filter((i): i is VaultItem => i !== null), unreadable }
}

/* ------------------------------------------------------ lock settings */

export type VaultOnLeave = 'now' | '1min' | 'off'
export interface VaultLockPrefs {
  /** Lock after this many minutes without a tap. */
  idleMinutes: 1 | 5 | 15
  /** Lock when you switch away from Luma (or the screen locks). */
  onLeave: VaultOnLeave
}

const LOCK_PREFS_KEY = 'lumaui:vault-lock'
const DEFAULT_LOCK: VaultLockPrefs = { idleMinutes: 5, onLeave: '1min' }
const prefListeners = new Set<() => void>()

function readLockPrefs(): VaultLockPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(LOCK_PREFS_KEY) ?? '{}') as Partial<VaultLockPrefs>
    return {
      idleMinutes: [1, 5, 15].includes(Number(p.idleMinutes)) ? (Number(p.idleMinutes) as 1 | 5 | 15) : DEFAULT_LOCK.idleMinutes,
      onLeave: p.onLeave === 'now' || p.onLeave === '1min' || p.onLeave === 'off' ? p.onLeave : DEFAULT_LOCK.onLeave,
    }
  } catch {
    return DEFAULT_LOCK
  }
}

let lockPrefs = readLockPrefs()

export function setVaultLockPrefs(next: Partial<VaultLockPrefs>) {
  lockPrefs = { ...lockPrefs, ...next }
  try {
    localStorage.setItem(LOCK_PREFS_KEY, JSON.stringify(lockPrefs))
  } catch {
    // kept for this page only
  }
  prefListeners.forEach((l) => l())
}

export function useVaultLockPrefs(): VaultLockPrefs {
  return useSyncExternalStore(
    (l) => {
      prefListeners.add(l)
      return () => prefListeners.delete(l)
    },
    () => lockPrefs,
  )
}

/* ------------------------------------------------------------ auto-lock */

let lastActivity = Date.now()
let hiddenAt = 0
let idleTimer: number | undefined
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

function markActive() {
  lastActivity = Date.now()
}

function checkIdle() {
  if (key && Date.now() - lastActivity >= lockPrefs.idleMinutes * 60_000) lockVault()
}

function onVisibility() {
  if (!key) return
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
    if (lockPrefs.onLeave === 'now') lockVault()
    return
  }
  if (lockPrefs.onLeave === '1min' && hiddenAt && Date.now() - hiddenAt >= 60_000) lockVault()
  hiddenAt = 0
  checkIdle()
}

function startIdleWatch() {
  lastActivity = Date.now()
  hiddenAt = 0
  ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }))
  document.addEventListener('visibilitychange', onVisibility)
  window.clearInterval(idleTimer)
  idleTimer = window.setInterval(checkIdle, 10_000)
}

function stopIdleWatch() {
  ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive))
  document.removeEventListener('visibilitychange', onVisibility)
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
      serverV2 = !!status.v2
      const data = await getVault()
      meta = data.meta
      raw = data.items
      loadedAt = Date.now()
      if (!meta) {
        set({ phase: 'setup', refreshing: false, error: null })
      } else if (key) {
        const { items, unreadable } = await decryptAll(key, raw, meta)
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
  // Argon2id when the deployment and this browser support it; the older format otherwise.
  const created = serverV2 ? await createVaultKey(password).catch(() => createVaultKeyV1(password)) : await createVaultKeyV1(password)
  const saved = await vaultApi.setup(created.meta)
  meta = saved.meta
  raw = []
  key = created.key
  loadedAt = Date.now()
  startIdleWatch()
  set({ phase: 'unlocked', items: [], unreadable: 0, error: null })
}

/**
 * Re-encrypts every item under Argon2id with item-bound encryption, in ONE write (the script
 * refuses if anything changed meanwhile). Any problem leaves the vault exactly as it was.
 */
async function upgradeToV2(password: string, oldKey: CryptoKey, oldMeta: VaultMeta): Promise<void> {
  const latest = await getVault()
  if (!latest.meta || latest.meta.salt !== oldMeta.salt) return // changed elsewhere; try another time
  const { items, unreadable } = await decryptAll(oldKey, latest.items, oldMeta)
  if (unreadable) return
  const created = await createVaultKey(password)
  const reencrypted = await Promise.all(items.map(async (item) => ({ id: item.id, data: await encryptText(created.key, JSON.stringify(contentOf(item)), aadFor(created.meta, item.id)) })))
  const saved = await vaultApi.rekey(created.meta, reencrypted)
  meta = saved.meta
  key = created.key
  raw = latest.items.map((r) => ({ ...r, data: reencrypted.find((x) => x.id === r.id)!.data }))
  forgetVaultBiometric()
}

/** False when the master password is wrong. */
export async function unlockVault(password: string): Promise<boolean> {
  if (!meta) return false
  const derived = await unlockVaultKey(password, meta)
  if (!derived) return false
  key = derived.key
  const { items, unreadable } = await decryptAll(derived.key, raw, meta)
  startIdleWatch()
  set({ phase: 'unlocked', items, unreadable, error: null })
  if (meta.v === 1 && serverV2 && !unreadable) {
    try {
      await upgradeToV2(password, derived.key, meta)
    } catch (err) {
      // Stays on the older format and works as before; the upgrade is tried again next unlock.
      if (import.meta.env.DEV) console.warn('[vault] upgrade to Argon2id skipped:', err)
    }
  }
  // Pick up anything added from another device since the list was fetched.
  void loadVault()
  return true
}

function requireKey(): { k: CryptoKey; m: VaultMeta } {
  if (!key || !meta) throw new Error('The vault is locked. Unlock it and try again.')
  return { k: key, m: meta }
}

export async function saveVaultItem(content: VaultItemContent, id?: string): Promise<VaultItem> {
  const { k, m } = requireKey()
  const clean: VaultItemContent = {
    type: content.type,
    title: content.title.trim(),
    group: content.group.trim(),
    favorite: content.favorite,
    fields: Object.fromEntries(Object.entries(content.fields).map(([f, v]) => [f, v.trim()]).filter(([, v]) => v)),
    notes: content.notes.trim(),
  }
  // v2: a new item's id is chosen here and sealed into its ciphertext.
  const newId = !id && m.v === 2 ? newVaultItemId() : undefined
  const data = await encryptText(k, JSON.stringify(clean), aadFor(m, id ?? newId ?? ''))
  const { item: row } = await vaultApi.save(data, id, newId)
  if (newId && row.id !== newId) throw new Error('The vault answered with a different item id. Please update the Apps Script deployment.')
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
  const { items, unreadable } = await decryptAll(check.key, latest.items, latest.meta ?? meta)
  if (unreadable) throw new Error(`${unreadable} item(s) couldn't be read, so the password wasn't changed.`)
  const created = serverV2 ? await createVaultKey(next) : await createVaultKeyV1(next)
  const reencrypted = await Promise.all(items.map(async (item) => ({ id: item.id, data: await encryptText(created.key, JSON.stringify(contentOf(item)), aadFor(created.meta, item.id)) })))
  const saved = await vaultApi.rekey(created.meta, reencrypted)
  meta = saved.meta
  key = created.key
  raw = latest.items.map((r) => ({ ...r, data: reencrypted.find((x) => x.id === r.id)!.data }))
  forgetVaultBiometric() // the Face ID copy was of the old key
  set({ items, unreadable: 0 })
  return true
}

/** Erases every item and the master password (for a forgotten password). */
export async function resetVault(): Promise<void> {
  await vaultApi.reset()
  lockVault()
  forgetVaultBiometric()
  meta = null
  raw = []
  set({ phase: 'setup', items: [], unreadable: 0 })
}

/* ---------------------------------------------------- Face ID for the Vault */

const BIO_KEY = 'lumavault:v1'
interface VaultBioRecord {
  /** The vault salt this key belongs to — a new master password makes the record stale. */
  salt: string
  wrap: BiometricWrap
}

function readBio(): VaultBioRecord | null {
  try {
    return JSON.parse(localStorage.getItem(BIO_KEY) ?? 'null') as VaultBioRecord | null
  } catch {
    return null
  }
}

export function forgetVaultBiometric() {
  try {
    localStorage.removeItem(BIO_KEY)
  } catch {
    // nothing stored
  }
  listeners.forEach((l) => l())
}

/** 'on' = Face ID can open the vault here; 'off' = possible but not turned on; 'unavailable' = needs Face ID sign-in / a v2 vault. */
export function vaultBiometricStatus(): 'on' | 'off' | 'unavailable' {
  if (!meta || meta.v !== 2 || !enrolledDevice()) return 'unavailable'
  const rec = readBio()
  return rec && rec.salt === meta.salt ? 'on' : 'off'
}

/** Asks for the master password once, then Face ID, and keeps an encrypted copy of the key here. */
export async function enableVaultBiometric(password: string): Promise<boolean> {
  if (!meta || meta.v !== 2) throw new Error('Unlock the vault once with your master password first — it upgrades its encryption.')
  const derived = await unlockVaultKey(password, meta)
  if (!derived?.raw) return false
  try {
    const wrap = await wrapWithBiometric(derived.raw, 'vault')
    localStorage.setItem(BIO_KEY, JSON.stringify({ salt: meta.salt, wrap } satisfies VaultBioRecord))
  } finally {
    derived.raw.fill(0)
  }
  listeners.forEach((l) => l())
  return true
}

/** Face ID → unlocked. False when the stored key no longer fits (it's then forgotten). */
export async function unlockVaultWithBiometric(): Promise<boolean> {
  const rec = readBio()
  if (!meta || meta.v !== 2 || !rec || rec.salt !== meta.salt) return false
  const rawKey = await unwrapWithBiometric(rec.wrap, 'vault')
  let k: CryptoKey
  try {
    k = await importVaultKey(rawKey)
  } finally {
    rawKey.fill(0)
  }
  if (!(await keyMatches(k, meta))) {
    forgetVaultBiometric()
    return false
  }
  key = k
  const { items, unreadable } = await decryptAll(k, raw, meta)
  startIdleWatch()
  set({ phase: 'unlocked', items, unreadable, error: null })
  void loadVault()
  return true
}

/** Which key-stretching this vault uses (for the security panel). */
export const vaultKdfLabel = () => (meta?.v === 2 ? 'Argon2id · 64 MB · 3 passes' : meta ? 'PBKDF2 · 600,000 rounds (upgrades on next unlock)' : '')

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
