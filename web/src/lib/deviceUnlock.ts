/**
 * Face ID / Touch ID / fingerprint sign-in, built on a passkey with the WebAuthn PRF extension.
 *
 * Turning it on:
 *   1. A passkey is created on this device (Face ID asks once).
 *   2. Its PRF output — a secret only this passkey can produce, after a successful Face ID —
 *      is stretched (HKDF) into an AES-256-GCM key.
 *   3. The script registers the device and returns a long random device secret.
 *   4. That secret is stored here ENCRYPTED with the passkey-derived key.
 *
 * Signing in: Face ID → PRF output → key → decrypt the secret → the script swaps it for a normal
 * 2-hour session. Without the biometric, the stored blob is useless; the script can revoke the
 * device at any time ("Sign out everywhere" revokes all of them).
 *
 * Stored under a key outside the luma:* data namespace so the 2-hour session wipe keeps it —
 * it holds nothing readable.
 */

const STORE_KEY = 'lumadevice:v1'
const HKDF_INFO = new TextEncoder().encode('luma-device-unlock-v1')

interface DeviceRecord {
  credentialId: string
  deviceId: string
  prfSalt: string
  iv: string
  ct: string
  createdAt: string
}

const b64 = (bytes: ArrayBuffer | Uint8Array) => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  arr.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const unb64 = (text: string): Uint8Array<ArrayBuffer> => {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4))
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

/** What to call it on this device. */
export function biometricLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'Face ID'
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'Face ID'
  if (/Macintosh/.test(ua)) return 'Touch ID'
  if (/Android/.test(ua)) return 'fingerprint'
  if (/Windows/.test(ua)) return 'Windows Hello'
  return 'device unlock'
}

/** A built-in authenticator with user verification exists (doesn't yet prove PRF support). */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return typeof PublicKeyCredential !== 'undefined' && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

export function enrolledDevice(): { deviceId: string; createdAt: string } | null {
  try {
    const rec = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as DeviceRecord | null
    return rec && rec.credentialId && rec.deviceId ? { deviceId: rec.deviceId, createdAt: rec.createdAt } : null
  } catch {
    return null
  }
}

export function forgetDevice() {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // nothing stored
  }
}

async function keyFromPrf(prf: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: HKDF_INFO }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } }

/** Runs Face ID against the passkey and returns its PRF output for `salt`. */
async function evaluatePrf(credentialId: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      allowCredentials: [{ type: 'public-key', id: credentialId }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null
  const first = (assertion?.getClientExtensionResults() as PrfResults | undefined)?.prf?.results?.first
  if (!first) throw new BiometricUnsupportedError()
  return first
}

export class BiometricUnsupportedError extends Error {
  constructor() {
    super("This device can't keep a Face ID key for Luma (it needs iOS 18 / a recent browser with passkeys). Keep using your passcode.")
    this.name = 'BiometricUnsupportedError'
  }
}

/** The user closed the Face ID prompt — not worth an error message. */
export function isBiometricCancel(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')
}

/**
 * Turns on biometric sign-in for this device. `register` asks the script for a device secret
 * (needs a signed-in session) and is only called once the passkey is known to support PRF.
 */
export async function enrollThisDevice(register: (deviceName: string) => Promise<{ deviceId: string; secret: string }>): Promise<void> {
  const prfSalt = random(32)
  const created = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Luma' },
      user: { id: random(16), name: 'Luma', displayName: 'Luma' },
      challenge: random(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
      timeout: 60_000,
      extensions: { prf: { eval: { first: prfSalt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null
  if (!created) throw new BiometricUnsupportedError()
  const ext = created.getClientExtensionResults() as PrfResults
  if (ext.prf?.enabled === false) throw new BiometricUnsupportedError()

  const credentialId = new Uint8Array(created.rawId)
  // Some platforms return the PRF output at creation; others only on a sign-in (a second prompt).
  const prf = ext.prf?.results?.first ?? (await evaluatePrf(credentialId, prfSalt))
  const key = await keyFromPrf(prf)

  const label = `${biometricLabel()} · ${/iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) ? 'iPad' : /Android/.test(navigator.userAgent) ? 'Android' : /Macintosh/.test(navigator.userAgent) ? 'Mac' : /Windows/.test(navigator.userAgent) ? 'Windows' : 'browser'}`
  const { deviceId, secret } = await register(label)
  const iv = random(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret))

  const record: DeviceRecord = { credentialId: b64(credentialId), deviceId, prfSalt: b64(prfSalt), iv: b64(iv), ct: b64(ct), createdAt: new Date().toISOString() }
  localStorage.setItem(STORE_KEY, JSON.stringify(record))
}

/** Face ID → the device secret, ready to exchange for a session. */
export async function unlockThisDevice(): Promise<{ deviceId: string; secret: string }> {
  const raw = localStorage.getItem(STORE_KEY)
  if (!raw) throw new Error('Face ID sign-in isn\'t set up on this device.')
  const rec = JSON.parse(raw) as DeviceRecord
  const prf = await evaluatePrf(unb64(rec.credentialId), unb64(rec.prfSalt))
  const key = await keyFromPrf(prf)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, key, unb64(rec.ct))
  return { deviceId: rec.deviceId, secret: new TextDecoder().decode(plain) }
}
