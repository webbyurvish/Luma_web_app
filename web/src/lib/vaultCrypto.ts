/**
 * Vault encryption — everything happens in this browser tab.
 *
 * The master password is stretched with PBKDF2-SHA256 (600k iterations, random salt) into an
 * AES-256-GCM key that is created non-extractable and lives only in memory. Items are encrypted
 * one by one with a fresh 12-byte IV; the Apps Script only ever stores "iv.ciphertext" strings.
 * A known phrase encrypted with the key ("check") lets us tell a wrong master password apart
 * without storing anything derived from the password itself.
 */

export const VAULT_ITERATIONS = 600_000
const CHECK_PHRASE = 'luma-vault-v1'

export interface VaultMeta {
  v: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  check: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toB64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export async function deriveVaultKey(password: string, salt: string, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64Url(salt), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text))
  return `${toB64Url(iv)}.${toB64Url(new Uint8Array(cipher))}`
}

export async function decryptText(key: CryptoKey, blob: string): Promise<string> {
  const [iv, data] = blob.split('.')
  if (!iv || !data) throw new Error('Malformed vault item.')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64Url(iv) }, key, fromB64Url(data))
  return decoder.decode(plain)
}

/** A brand-new vault: fresh salt, key and check value. */
export async function createVaultKey(password: string): Promise<{ key: CryptoKey; meta: VaultMeta }> {
  const salt = toB64Url(crypto.getRandomValues(new Uint8Array(16)))
  const key = await deriveVaultKey(password, salt, VAULT_ITERATIONS)
  const check = await encryptText(key, CHECK_PHRASE)
  return { key, meta: { v: 1, kdf: 'PBKDF2-SHA256', iterations: VAULT_ITERATIONS, salt, check } }
}

/** The key for this master password, or null when the password is wrong. */
export async function unlockVaultKey(password: string, meta: VaultMeta): Promise<CryptoKey | null> {
  const key = await deriveVaultKey(password, meta.salt, meta.iterations)
  try {
    return (await decryptText(key, meta.check)) === CHECK_PHRASE ? key : null
  } catch {
    return null // GCM authentication failed: wrong password
  }
}
