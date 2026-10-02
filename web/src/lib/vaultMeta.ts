import { CreditCard, FileBadge, KeyRound, Landmark, StickyNote, UserRound, Wifi, type LucideIcon } from 'lucide-react'
import type { VaultItem, VaultItemContent, VaultItemType } from '@/types'

export type VaultFieldKind = 'text' | 'secret' | 'url' | 'cardNumber' | 'expiry' | 'select' | 'pin' | 'textarea'

export interface VaultFieldDef {
  key: string
  label: string
  kind: VaultFieldKind
  placeholder?: string
  options?: string[]
  /** Shows a copy button. */
  copy?: boolean
  /** Masked until revealed, and never matched by search. */
  sensitive?: boolean
  /** Only the last 4 characters are visible while hidden (numbers you recognise by their end). */
  showLast4?: boolean
  inputMode?: 'numeric' | 'text' | 'email' | 'url'
  /** Half-width in the editor. */
  half?: boolean
}

export interface VaultTypeMeta {
  label: string
  plural: string
  icon: LucideIcon
  description: string
  titlePlaceholder: string
  fields: VaultFieldDef[]
}

export const VAULT_TYPE_META: Record<VaultItemType, VaultTypeMeta> = {
  person: {
    label: 'Family member',
    plural: 'Form kits',
    icon: UserRound,
    description: 'Everything forms ask for, one tap to copy',
    titlePlaceholder: 'e.g. Mom — Sunita Sharma',
    fields: [
      { key: 'fullName', label: 'Full name (as on ID)', kind: 'text', copy: true },
      { key: 'dob', label: 'Date of birth', kind: 'text', placeholder: 'DD/MM/YYYY', copy: true, half: true },
      { key: 'gender', label: 'Gender', kind: 'select', options: ['Female', 'Male', 'Other'], half: true },
      { key: 'fatherName', label: "Father's name", kind: 'text', copy: true },
      { key: 'motherName', label: "Mother's name", kind: 'text', copy: true },
      { key: 'spouseName', label: "Spouse's name", kind: 'text', copy: true },
      { key: 'mobile', label: 'Mobile', kind: 'text', copy: true, inputMode: 'numeric', half: true },
      { key: 'email', label: 'Email', kind: 'text', copy: true, inputMode: 'email', half: true },
      { key: 'aadhaar', label: 'Aadhaar number', kind: 'text', copy: true, sensitive: true, showLast4: true, inputMode: 'numeric' },
      { key: 'pan', label: 'PAN', kind: 'text', copy: true, sensitive: true, showLast4: true, half: true },
      { key: 'voterId', label: 'Voter ID', kind: 'text', copy: true, sensitive: true, showLast4: true, half: true },
      { key: 'passport', label: 'Passport number', kind: 'text', copy: true, sensitive: true, showLast4: true, half: true },
      { key: 'passportExpiry', label: 'Passport valid till', kind: 'text', placeholder: 'DD/MM/YYYY', copy: true, half: true },
      { key: 'drivingLicence', label: 'Driving licence', kind: 'text', copy: true, sensitive: true, showLast4: true },
      { key: 'address', label: 'Address', kind: 'textarea', copy: true },
      { key: 'pincode', label: 'PIN code', kind: 'text', copy: true, inputMode: 'numeric', half: true },
      { key: 'bloodGroup', label: 'Blood group', kind: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], half: true },
      { key: 'bankAccount', label: 'Bank account number', kind: 'text', copy: true, sensitive: true, showLast4: true, inputMode: 'numeric' },
      { key: 'ifsc', label: 'IFSC', kind: 'text', copy: true, half: true },
      { key: 'occupation', label: 'Occupation', kind: 'text', copy: true, half: true },
      { key: 'maritalStatus', label: 'Marital status', kind: 'select', options: ['Single', 'Married', 'Widowed', 'Divorced'], half: true },
      { key: 'nationality', label: 'Nationality', kind: 'text', placeholder: 'Indian', copy: true, half: true },
    ],
  },
  login: {
    label: 'Login',
    plural: 'Logins',
    icon: KeyRound,
    description: 'Websites and apps',
    titlePlaceholder: 'e.g. Gmail, Netflix, HDFC NetBanking',
    fields: [
      { key: 'website', label: 'Website', kind: 'url', placeholder: 'https://', inputMode: 'url' },
      { key: 'username', label: 'Username / email', kind: 'text', copy: true, inputMode: 'email' },
      { key: 'password', label: 'Password', kind: 'secret', copy: true, sensitive: true },
    ],
  },
  card: {
    label: 'Card',
    plural: 'Cards',
    icon: CreditCard,
    description: 'Credit and debit cards',
    titlePlaceholder: 'e.g. HDFC Regalia',
    fields: [
      { key: 'cardKind', label: 'Card type', kind: 'select', options: ['Credit', 'Debit', 'Prepaid', 'Forex'], half: true },
      { key: 'issuer', label: 'Bank / issuer', kind: 'text', half: true },
      { key: 'holder', label: 'Name on card', kind: 'text', copy: true },
      { key: 'number', label: 'Card number', kind: 'cardNumber', copy: true, sensitive: true, showLast4: true, inputMode: 'numeric' },
      { key: 'expiry', label: 'Expiry', kind: 'expiry', placeholder: 'MM/YY', copy: true, inputMode: 'numeric', half: true },
      { key: 'cvv', label: 'CVV', kind: 'pin', copy: true, sensitive: true, inputMode: 'numeric', half: true },
      { key: 'pin', label: 'ATM PIN', kind: 'pin', copy: true, sensitive: true, inputMode: 'numeric', half: true },
    ],
  },
  bank: {
    label: 'Bank account',
    plural: 'Bank accounts',
    icon: Landmark,
    description: 'Account numbers, IFSC, net banking',
    titlePlaceholder: 'e.g. ICICI Savings',
    fields: [
      { key: 'bankName', label: 'Bank', kind: 'text', half: true },
      { key: 'accountType', label: 'Account type', kind: 'select', options: ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'FD', 'Other'], half: true },
      { key: 'holder', label: 'Account holder', kind: 'text', copy: true },
      { key: 'accountNumber', label: 'Account number', kind: 'text', copy: true, sensitive: true, showLast4: true, inputMode: 'numeric' },
      { key: 'ifsc', label: 'IFSC', kind: 'text', copy: true, half: true },
      { key: 'branch', label: 'Branch', kind: 'text', half: true },
      { key: 'customerId', label: 'Customer ID', kind: 'text', copy: true, sensitive: true, showLast4: true, half: true },
      { key: 'upiId', label: 'UPI ID', kind: 'text', copy: true, half: true },
      { key: 'netBankingUser', label: 'Net banking user ID', kind: 'text', copy: true, sensitive: true, showLast4: true },
      { key: 'netBankingPassword', label: 'Net banking password', kind: 'secret', copy: true, sensitive: true },
      { key: 'mpin', label: 'Mobile banking MPIN', kind: 'pin', copy: true, sensitive: true, inputMode: 'numeric', half: true },
      { key: 'upiPin', label: 'UPI PIN', kind: 'pin', copy: true, sensitive: true, inputMode: 'numeric', half: true },
    ],
  },
  identity: {
    label: 'ID document',
    plural: 'ID documents',
    icon: FileBadge,
    description: 'Aadhaar, PAN, passport, licence',
    titlePlaceholder: 'e.g. My PAN card',
    fields: [
      { key: 'docType', label: 'Document', kind: 'select', options: ['Aadhaar', 'PAN', 'Passport', 'Driving licence', 'Voter ID', 'Insurance policy', 'Other'], half: true },
      { key: 'nameOnDoc', label: 'Name on document', kind: 'text', half: true },
      { key: 'number', label: 'Number', kind: 'text', copy: true, sensitive: true, showLast4: true },
      { key: 'issued', label: 'Issued on', kind: 'text', placeholder: 'DD/MM/YYYY', half: true },
      { key: 'expiry', label: 'Valid until', kind: 'text', placeholder: 'DD/MM/YYYY', half: true },
    ],
  },
  wifi: {
    label: 'Wi-Fi',
    plural: 'Wi-Fi networks',
    icon: Wifi,
    description: 'Network passwords',
    titlePlaceholder: 'e.g. Home Wi-Fi',
    fields: [
      { key: 'ssid', label: 'Network name', kind: 'text', copy: true },
      { key: 'password', label: 'Password', kind: 'secret', copy: true, sensitive: true },
    ],
  },
  note: {
    label: 'Secure note',
    plural: 'Secure notes',
    icon: StickyNote,
    description: 'Recovery codes, lockers, anything private',
    titlePlaceholder: 'e.g. Google backup codes',
    fields: [],
  },
}

export const VAULT_TYPES = Object.keys(VAULT_TYPE_META) as VaultItemType[]
export const VAULT_GROUP_SUGGESTIONS = ['Personal', 'Family', 'Work', 'Business']
export const VAULT_NOTES_MAX = 10_000

export function emptyContent(type: VaultItemType): VaultItemContent {
  return { type, title: '', group: 'Personal', favorite: false, fields: {}, notes: '' }
}

/* ---------------------------------------------------------------- cards */

export type CardNetwork = 'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Diners' | 'Discover' | 'Maestro' | null

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

export function cardNetwork(number: string): CardNetwork {
  const n = digitsOnly(number)
  if (/^3[47]/.test(n)) return 'Amex'
  if (/^(508[5-9]|6069|607|608|652[1-9]|653|8[12])/.test(n) || /^60(?!11)/.test(n)) return 'RuPay'
  if (/^4/.test(n)) return 'Visa'
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(n)) return 'Mastercard'
  if (/^3(0[0-5]|[689])/.test(n)) return 'Diners'
  if (/^(6011|65|64[4-9])/.test(n)) return 'Discover'
  if (/^(5[06-9]|6)/.test(n)) return 'Maestro'
  return null
}

/** Luhn check — catches most typos in a card number. */
export function luhnValid(number: string): boolean {
  const n = digitsOnly(number)
  if (n.length < 12) return false
  let sum = 0
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

/** "4111 1111 1111 1111" (Amex: 4-6-5). */
export function formatCardNumber(value: string): string {
  const n = digitsOnly(value).slice(0, 19)
  if (/^3[47]/.test(n)) return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(' ')
  return n.replace(/(.{4})/g, '$1 ').trim()
}

/** Typing "0927" gives "09/27". */
export function formatExpiry(value: string): string {
  const n = digitsOnly(value).slice(0, 4)
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n
}

export type ExpiryState = 'expired' | 'soon' | 'ok' | null

/** Accepts MM/YY (cards) and DD/MM/YYYY (documents). "Soon" = within 60 days. */
export function expiryState(value: string | undefined): ExpiryState {
  if (!value) return null
  let end: Date | null = null
  const mmYy = /^(\d{2})\/(\d{2})$/.exec(value.trim())
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value.trim())
  if (mmYy) end = new Date(2000 + Number(mmYy[2]), Number(mmYy[1]), 0, 23, 59) // last day of that month
  else if (dmy) end = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 23, 59)
  if (!end || Number.isNaN(end.getTime())) return null
  const days = (end.getTime() - Date.now()) / 86_400_000
  return days < 0 ? 'expired' : days <= 60 ? 'soon' : 'ok'
}

/* ------------------------------------------------------------ passwords */

export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: '' }
  let pool = 0
  if (/[a-z]/.test(password)) pool += 26
  if (/[A-Z]/.test(password)) pool += 26
  if (/\d/.test(password)) pool += 10
  if (/[^A-Za-z0-9]/.test(password)) pool += 32
  const repeats = /(.)\1{2,}/.test(password) || /^(?:password|qwerty|123456|admin|welcome|letmein)/i.test(password)
  const bits = password.length * Math.log2(Math.max(pool, 1)) - (repeats ? 20 : 0)
  if (bits < 36) return { score: 1, label: 'Weak' }
  if (bits < 60) return { score: 2, label: 'Fair' }
  if (bits < 80) return { score: 3, label: 'Good' }
  return { score: 4, label: 'Strong' }
}

const GEN_SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*-_=+?',
}

/** Unbiased random password with at least one character from each chosen set. */
export function generatePassword(length = 20, symbols = true): string {
  const sets = [GEN_SETS.lower, GEN_SETS.upper, GEN_SETS.digits, ...(symbols ? [GEN_SETS.symbols] : [])]
  const all = sets.join('')
  const pick = (chars: string) => {
    const limit = 256 - (256 % chars.length)
    for (;;) {
      const [b] = crypto.getRandomValues(new Uint8Array(1))
      if (b < limit) return chars[b % chars.length]
    }
  }
  const out = sets.map(pick)
  while (out.length < length) out.push(pick(all))
  // Fisher–Yates shuffle so the guaranteed characters aren't always first.
  for (let i = out.length - 1; i > 0; i--) {
    const [r] = crypto.getRandomValues(new Uint32Array(1))
    const j = r % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join('')
}

/* -------------------------------------------------------------- display */

export function maskValue(value: string, showLast4?: boolean): string {
  if (!value) return ''
  if (showLast4 && value.replace(/\s/g, '').length > 4) return `•••• ${value.replace(/\s/g, '').slice(-4)}`
  return '••••••••'
}

/** One line under the title in the list — never a secret. */
export function itemSubtitle(item: VaultItemContent): string {
  const f = item.fields
  const last4 = (v?: string) => (v ? `•••• ${v.replace(/\s/g, '').slice(-4)}` : '')
  switch (item.type) {
    case 'person':
      return [f.fullName, f.dob].filter(Boolean).join(' · ') || 'Family member'
    case 'login':
      return f.username || hostOf(f.website) || 'Login'
    case 'card':
      return [cardNetwork(f.number ?? '') ?? f.issuer, last4(f.number)].filter(Boolean).join(' ') || 'Card'
    case 'bank':
      return [f.bankName, last4(f.accountNumber)].filter(Boolean).join(' ') || 'Bank account'
    case 'identity':
      return [f.docType, last4(f.number)].filter(Boolean).join(' ') || 'ID document'
    case 'wifi':
      return f.ssid || 'Wi-Fi'
    default:
      return 'Secure note'
  }
}

export function hostOf(url?: string): string {
  if (!url) return ''
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Safe link target: only http(s), so a stored "javascript:" URL can never run. */
export function safeHref(url?: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

/** Search text: titles and non-secret fields only. */
export function searchText(item: VaultItemContent): string {
  const meta = VAULT_TYPE_META[item.type]
  const open = meta.fields.filter((d) => !d.sensitive).map((d) => item.fields[d.key] ?? '')
  return [item.title, item.group, meta.label, itemSubtitle(item), ...open].join(' ').toLowerCase()
}

/** Expiry warnings for cards and documents. */
export function itemExpiry(item: VaultItemContent): ExpiryState {
  if (item.type !== 'card' && item.type !== 'identity') return null
  return expiryState(item.fields.expiry)
}

/** Passwords used by more than one item — worth changing. */
export function reusedPasswordIds(items: VaultItem[]): Set<string> {
  const byPassword = new Map<string, string[]>()
  items.forEach((item) => {
    const pw = item.fields.password || item.fields.netBankingPassword
    if (!pw) return
    byPassword.set(pw, [...(byPassword.get(pw) ?? []), item.id])
  })
  return new Set([...byPassword.values()].filter((ids) => ids.length > 1).flat())
}
