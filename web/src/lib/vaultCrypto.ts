/**
 * Vault encryption — everything happens in this browser tab.
 *
 * v2 (what new and upgraded vaults use): the master password is stretched with Argon2id
 * (64 MiB, 3 passes — memory-hard, so guessing on GPUs is slow and costly) into an AES-256-GCM
 * key that lives only in memory. Each item is encrypted with a fresh 12-byte IV and its own id
 * as associated data, so a ciphertext only opens in its own slot — rows can't be swapped or
 * replayed into another item unnoticed.
 *
 * v1 (older vaults): PBKDF2-SHA256, 600k iterations, no associated data. Still opens, and is
 * upgraded to v2 on the next unlock.
 *
 * The Apps Script only ever stores "iv.ciphertext" strings. A known phrase encrypted with the
 * key ("check") tells a wrong master password apart without storing anything derived from it.
 */
export const VAULT_ITERATIONS = 600_000
const CHECK_PHRASE = 'luma-vault-v1'

/** Argon2id settings (OWASP / Bitwarden-class: 64 MiB memory, 3 passes). */
export const ARGON2 = { memory: 65_536, iterations: 3, parallelism: 1 } as const

export interface VaultMetaV1 {
  v: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  check: string
}

export interface VaultMetaV2 {
  v: 2
  kdf: 'argon2id'
  /** KiB */
  memory: number
  iterations: number
  parallelism: number
  salt: string
  check: string
}

export type VaultMeta = VaultMetaV1 | VaultMetaV2

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

/** Associated data that seals a ciphertext to its place (v2 only). */
export const itemAad = (id: string) => `luma-vault:item:${id}`
const CHECK_AAD = 'luma-vault:check'

/* ------------------------------------------------------------- keys */

async function pbkdf2Key(password: string, salt: string, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64Url(salt), iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** Argon2id → 32 raw key bytes. Loaded on first use (WebAssembly, ~30 KB). */
async function argon2Raw(password: string, meta: Pick<VaultMetaV2, 'salt' | 'memory' | 'iterations' | 'parallelism'>): Promise<Uint8Array<ArrayBuffer>> {
  let argon2id: typeof import('hash-wasm').argon2id
  try {
    ;({ argon2id } = await import('hash-wasm'))
  } catch {
    throw new Error("This browser can't load the vault's encryption. Update iOS or your browser, then try again.")
  }
  const out = await argon2id({
    password: password.normalize('NFC'),
    salt: fromB64Url(meta.salt),
    memorySize: meta.memory,
    iterations: meta.iterations,
    parallelism: meta.parallelism,
    hashLength: 32,
    outputType: 'binary',
  })
  return new Uint8Array(out)
}

/** Raw key bytes → a non-extractable AES-GCM key (the bytes are only kept by the caller if needed). */
export function importVaultKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/* --------------------------------------------------------- encrypt */

export async function encryptText(key: CryptoKey, text: string, aad?: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const params: AesGcmParams = aad ? { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) } : { name: 'AES-GCM', iv }
  const cipher = await crypto.subtle.encrypt(params, key, encoder.encode(text))
  return `${toB64Url(iv)}.${toB64Url(new Uint8Array(cipher))}`
}

export async function decryptText(key: CryptoKey, blob: string, aad?: string): Promise<string> {
  const [iv, data] = blob.split('.')
  if (!iv || !data) throw new Error('Malformed vault item.')
  const params: AesGcmParams = aad ? { name: 'AES-GCM', iv: fromB64Url(iv), additionalData: encoder.encode(aad) } : { name: 'AES-GCM', iv: fromB64Url(iv) }
  const plain = await crypto.subtle.decrypt(params, key, fromB64Url(data))
  return decoder.decode(plain)
}

/** The associated data an item of this vault version uses. */
export const aadFor = (meta: VaultMeta, id: string) => (meta.v === 2 ? itemAad(id) : undefined)

/* ------------------------------------------------------- vault keys */

export interface DerivedKey {
  key: CryptoKey
  /** v2 only: the raw bytes, so Face ID unlock can be set up without asking again. Drop after use. */
  raw: Uint8Array<ArrayBuffer> | null
}

/** A brand-new v2 vault: fresh salt, Argon2id key and check value. */
export async function createVaultKey(password: string): Promise<DerivedKey & { meta: VaultMetaV2 }> {
  const salt = toB64Url(crypto.getRandomValues(new Uint8Array(16)))
  const settings = { salt, ...ARGON2 }
  const raw = await argon2Raw(password, settings)
  const key = await importVaultKey(raw)
  const check = await encryptText(key, CHECK_PHRASE, CHECK_AAD)
  return { key, raw, meta: { v: 2, kdf: 'argon2id', ...settings, check } }
}

/** The pre-Argon2 format, only for a deployment that doesn't accept v2 yet. */
export async function createVaultKeyV1(password: string): Promise<{ key: CryptoKey; meta: VaultMetaV1 }> {
  const salt = toB64Url(crypto.getRandomValues(new Uint8Array(16)))
  const key = await pbkdf2Key(password, salt, VAULT_ITERATIONS)
  const check = await encryptText(key, CHECK_PHRASE)
  return { key, meta: { v: 1, kdf: 'PBKDF2-SHA256', iterations: VAULT_ITERATIONS, salt, check } }
}

/** Does this key open this vault? (checks the encrypted check phrase) */
export async function keyMatches(key: CryptoKey, meta: VaultMeta): Promise<boolean> {
  try {
    return (await decryptText(key, meta.check, meta.v === 2 ? CHECK_AAD : undefined)) === CHECK_PHRASE
  } catch {
    return false // GCM authentication failed: wrong key
  }
}

/** The key for this master password, or null when the password is wrong. */
export async function unlockVaultKey(password: string, meta: VaultMeta): Promise<DerivedKey | null> {
  if (meta.v === 2) {
    const raw = await argon2Raw(password, meta)
    const key = await importVaultKey(raw)
    return (await keyMatches(key, meta)) ? { key, raw } : null
  }
  const key = await pbkdf2Key(password, meta.salt, meta.iterations)
  return (await keyMatches(key, meta)) ? { key, raw: null } : null
}

/** A new item's id, chosen here so it can be sealed into the ciphertext. Matches the script's format. */
export function newVaultItemId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return 'VLT-' + Array.from(bytes, (b) => alphabet[b % 36]).join('')
}
