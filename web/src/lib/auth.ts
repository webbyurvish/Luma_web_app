/**
 * The signed session token from the Apps Script passcode gate (never the passcode itself).
 * Kept in localStorage so a remembered session survives reloads; wiped on sign-out together
 * with every cached copy of the user's data.
 */
const TOKEN_KEY = 'luma:auth:v1'
/** Last known 'is a passcode required?' answer, so the gate never waits on Google to decide. */
const AUTH_STATUS_KEY = 'luma:auth-status'

export function rememberPasscodeRequired(required: boolean) {
  try {
    localStorage.setItem(AUTH_STATUS_KEY, required ? '1' : '0')
  } catch {
    // ignore
  }
}

export function passcodeKnownRequired(): boolean {
  try {
    return localStorage.getItem(AUTH_STATUS_KEY) === '1'
  } catch {
    return false
  }
}

interface StoredSession {
  token: string
  expiresAt: number
}

let session: StoredSession | null = read()

function read(): StoredSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as StoredSession | null
    return parsed && typeof parsed.token === 'string' && parsed.expiresAt > Date.now() ? parsed : null
  } catch {
    return null
  }
}

export function getAuthToken(): string | null {
  if (session && session.expiresAt <= Date.now()) session = null
  return session?.token ?? null
}

export function setAuthSession(token: string, expiresAt: number) {
  session = { token, expiresAt }
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
  } catch {
    // Storage blocked: the session lasts until the tab closes.
  }
}

/** Forget the session and every locally cached copy of the user's data. */
export function clearAuthSession() {
  session = null
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('luma:') && k !== AUTH_STATUS_KEY)
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // Nothing more to clear.
  }
}

/* The API layer reports a refused request here; the auth gate listens and shows sign-in. */
const listeners = new Set<() => void>()

export function onAuthRequired(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function reportAuthRequired() {
  session = null
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}
