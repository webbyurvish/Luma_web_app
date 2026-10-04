import { VAULT_TYPE_META, passwordStrength } from './vaultMeta'
import type { VaultItem } from '@/types'

/**
 * Password health, computed on this phone from the unlocked vault: weak, reused and old
 * passwords — and, only when asked, a breach check with Have I Been Pwned (k-anonymity: just the
 * first 5 characters of the password's SHA-1 fingerprint leave the phone; the matching is done here).
 */

export interface SecretRef {
  itemId: string
  title: string
  field: string
  label: string
  value: string
  updatedAt: string
}

export type Issue = 'weak' | 'reused' | 'old' | 'breached'

export interface HealthEntry extends Omit<SecretRef, 'value'> {
  issues: Issue[]
  /** Times seen in breaches (when checked). */
  breachCount?: number
}

const OLD_AFTER_DAYS = 365

/** Every password-type field (PINs and CVVs aren't checked: every short PIN is "breached"). */
export function vaultSecrets(items: VaultItem[]): SecretRef[] {
  const out: SecretRef[] = []
  for (const item of items) {
    const defs = VAULT_TYPE_META[item.type]?.fields ?? []
    for (const def of defs) {
      if (def.kind !== 'secret') continue
      const value = item.fields[def.key]
      if (value) out.push({ itemId: item.id, title: item.title, field: def.key, label: def.label, value, updatedAt: item.updatedAt })
    }
  }
  return out
}

export function analyseHealth(items: VaultItem[], breaches?: Map<string, number>, now = Date.now()): HealthEntry[] {
  const secrets = vaultSecrets(items)
  const uses = new Map<string, number>()
  secrets.forEach((s) => uses.set(s.value, (uses.get(s.value) ?? 0) + 1))
  return secrets
    .map(({ value, ...ref }) => {
      const issues: Issue[] = []
      const breachCount = breaches?.get(value)
      if (breachCount) issues.push('breached')
      if (passwordStrength(value).score < 2 || value.length < 8) issues.push('weak')
      if ((uses.get(value) ?? 0) > 1) issues.push('reused')
      const updated = Date.parse(ref.updatedAt)
      if (Number.isFinite(updated) && now - updated > OLD_AFTER_DAYS * 86_400_000) issues.push('old')
      return { ...ref, issues, breachCount }
    })
    .filter((e) => e.issues.length > 0)
    .sort((a, b) => rank(b) - rank(a))
}

const rank = (e: HealthEntry) => (e.issues.includes('breached') ? 8 : 0) + (e.issues.includes('reused') ? 4 : 0) + (e.issues.includes('weak') ? 2 : 0) + (e.issues.includes('old') ? 1 : 0)

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/**
 * How many times each password appears in known breaches (0 = not found). Sends only 5-character
 * hash prefixes, with padding so even the response size reveals nothing; one request per prefix.
 */
export async function checkBreaches(passwords: string[], onProgress?: (done: number, total: number) => void): Promise<Map<string, number>> {
  const unique = [...new Set(passwords)]
  const hashes = await Promise.all(unique.map(async (p) => [p, await sha1Hex(p)] as const))
  const byPrefix = new Map<string, { password: string; suffix: string }[]>()
  hashes.forEach(([password, hash]) => {
    const prefix = hash.slice(0, 5)
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), { password, suffix: hash.slice(5) }])
  })
  const result = new Map<string, number>()
  let done = 0
  for (const [prefix, list] of byPrefix) {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' }, referrerPolicy: 'no-referrer', credentials: 'omit', cache: 'no-store' })
    if (!res.ok) throw new Error(`The breach check service didn't answer (${res.status}). Try again later.`)
    const counts = new Map<string, number>()
    ;(await res.text()).split('\n').forEach((line) => {
      const [suffix, count] = line.trim().split(':')
      if (suffix && Number(count) > 0) counts.set(suffix, Number(count))
    })
    list.forEach(({ password, suffix }) => result.set(password, counts.get(suffix) ?? 0))
    onProgress?.(++done, byPrefix.size)
  }
  return result
}
