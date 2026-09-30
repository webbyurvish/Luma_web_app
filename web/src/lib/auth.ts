/**
 * The signed session token from the Apps Script passcode gate (never the passcode itself).
 * A session lasts at most 2 hours (the script refuses anything longer). It's kept in
 * localStorage so other tabs share it; when it ends — expiry, sign-out or a refused request —
 * it's wiped together with every cached copy of the user's data on this device.
 */
const TOKEN_KEY = 'luma:auth:v1'
/** Last known 'is a passcode required?' answer. */
const AUTH_STATUS_KEY = 'luma:auth-status'
/** The app never trusts a stored expiry beyond this, whatever the token claims. */
export const SESSION_MAX_MS = 2 * 60 * 60 * 1000

export function rememberPasscodeRequired(required: boolean) {
  try {
    localStorage.setItem(AUTH_STATUS_KEY, required ? '1' : '0')
  } catch {
    // ignore
  }
}

interface StoredSession {
  token: string
  expiresAt: number
}

/** Drops every luma:* key (cached data, token…) except the harmless auth-status flag. */
function wipeLocalData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('luma:') && k !== AUTH_STATUS_KEY)
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // Nothing more to clear.
  }
}

function valid(s: StoredSession | null): s is StoredSession {
  return !!s && typeof s.token === 'string' && s.expiresAt > Date.now() && s.expiresAt - Date.now() <= SESSION_MAX_MS + 60_000
}

let session: StoredSession | null = read()

function read(): StoredSession | null {
  let parsed: StoredSession | null = null
  try {
    parsed = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as StoredSession | null
  } catch {
    parsed = null
  }
  if (valid(parsed)) return parsed
  // No live session on this device: nothing from an earlier one may stay readable here.
  wipeLocalData()
  return null
}

/** Picks up a sign-in / sign-out done in another tab. */
function syncFromStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as StoredSession | null
    session = valid(parsed) ? parsed : null
  } catch {
    // keep what we have
  }
}

export function getAuthToken(): string | null {
  if (session && !valid(session)) syncFromStorage()
  if (session && !valid(session)) session = null
  return session?.token ?? null
}

/** When the current session ends (ms since epoch), or null when signed out. */
export function getSessionExpiry(): number | null {
  return getAuthToken() ? session!.expiresAt : null
}

export function setAuthSession(token: string, expiresAt: number) {
  session = { token, expiresAt: Math.min(expiresAt, Date.now() + SESSION_MAX_MS) }
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
  } catch {
    // Storage blocked: the session lasts until the tab closes.
  }
}

const endListeners = new Set<() => void>()

/** Called whenever the session ends for any reason (e.g. to lock the vault). */
export function onSessionEnd(listener: () => void): () => void {
  endListeners.add(listener)
  return () => endListeners.delete(listener)
}

/** Forget the session and every locally cached copy of the user's data. */
export function clearAuthSession() {
  session = null
  wipeLocalData()
  endListeners.forEach((l) => l())
}

/* The API layer reports a refused request here; the auth gate listens and shows sign-in. */
const listeners = new Set<() => void>()

export function onAuthRequired(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function reportAuthRequired() {
  clearAuthSession()
  rememberPasscodeRequired(true)
  listeners.forEach((l) => l())
}
