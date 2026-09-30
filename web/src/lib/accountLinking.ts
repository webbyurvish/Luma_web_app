import type { AccountType, FinancialAccount } from '@/types'

/**
 * Which accounts make sense for a payment method, and how an entry moves a balance.
 * The balance rules mirror apps-script/Luma_Ledger.js exactly, so the preview the editor
 * shows is what the sheet will hold after saving.
 */

export type MoneyDirection = 'out' | 'in'

/** Payment methods grouped by where the money actually comes from. */
const METHOD_ACCOUNT_TYPES: { match: RegExp; types: AccountType[] }[] = [
  { match: /credit|card/i, types: ['credit_card'] }, // "Card", "Credit Card"
  { match: /cash/i, types: ['cash'] },
  { match: /wallet|paytm|amazon pay|phonepe wallet/i, types: ['wallet'] },
  { match: /upi|bank|neft|imps|rtgs|net ?banking|debit|cheque|check|auto ?debit|emi/i, types: ['bank'] },
]

/** Account types that fit a payment method; empty when the method doesn't imply one. */
export function accountTypesFor(paymentMethod: string): AccountType[] {
  if (!paymentMethod.trim()) return []
  // "Debit card" is a bank account, even though it says "card".
  if (/debit/i.test(paymentMethod)) return ['bank']
  return METHOD_ACCOUNT_TYPES.find((m) => m.match.test(paymentMethod))?.types ?? []
}

/** Active accounts suited to a method, best matches first, then everything else. */
export function accountsForMethod(accounts: FinancialAccount[], paymentMethod: string): { suggested: FinancialAccount[]; others: FinancialAccount[] } {
  const active = accounts.filter((a) => a.isActive)
  const types = accountTypesFor(paymentMethod)
  if (!types.length) return { suggested: [], others: active }
  return { suggested: active.filter((a) => types.includes(a.type)), others: active.filter((a) => !types.includes(a.type)) }
}

/* Remember the last account used with each payment method (a per-browser convenience). */
const LAST_KEY = 'luma:last-account-by-method'

function readLast(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function rememberAccountFor(paymentMethod: string, accountId: string) {
  if (!paymentMethod.trim() || !accountId) return
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ ...readLast(), [paymentMethod.trim().toLowerCase()]: accountId }))
  } catch {
    // ignore
  }
}

/** The account to pre-select: last one used with this method, else the only/first suitable one. */
export function defaultAccountFor(accounts: FinancialAccount[], paymentMethod: string): string {
  const { suggested } = accountsForMethod(accounts, paymentMethod)
  if (!suggested.length) return ''
  const last = readLast()[paymentMethod.trim().toLowerCase()]
  if (last && suggested.some((a) => a.id === last)) return last
  return suggested[0].id
}

/**
 * Signed change to an account's balance. `delta` is written for money-holding accounts;
 * credit cards store what you owe, so their change flips.
 */
function signed(account: FinancialAccount | undefined, delta: number): number {
  if (!account) return 0
  return account.type === 'credit_card' ? -delta : delta
}

export interface BalanceChange {
  account: FinancialAccount
  before: number
  after: number
}

/** What saving an entry would do to the accounts involved. */
export function previewBalanceChanges(
  accounts: FinancialAccount[],
  entry: { kind: 'expense' | 'income' | 'transfer' | 'udhaar_given' | 'udhaar_repayment'; amount: number; accountId?: string; toAccountId?: string },
): BalanceChange[] {
  const amount = Math.abs(entry.amount) || 0
  if (!amount) return []
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const changes = new Map<string, number>()
  const add = (id: string | undefined, delta: number) => {
    const acc = id ? byId.get(id) : undefined
    if (acc) changes.set(acc.id, (changes.get(acc.id) ?? 0) + signed(acc, delta))
  }
  if (entry.kind === 'expense' || entry.kind === 'udhaar_given') add(entry.accountId, -amount)
  if (entry.kind === 'income' || entry.kind === 'udhaar_repayment') add(entry.accountId, amount)
  if (entry.kind === 'transfer' && entry.accountId && entry.toAccountId && entry.accountId !== entry.toAccountId) {
    add(entry.accountId, -amount)
    add(entry.toAccountId, amount)
  }
  return [...changes.entries()].map(([id, change]) => {
    const account = byId.get(id)!
    return { account, before: account.balance, after: Math.round((account.balance + change) * 100) / 100 }
  })
}

/** "ICICI Bank ••4821" style label. */
export function accountLabel(account: FinancialAccount): string {
  return account.accountNumberLast4 ? `${account.name} ••${account.accountNumberLast4}` : account.name
}

/** Case-insensitive name match for AI-parsed account names ("HDFC" → "HDFC Bank"). */
export function matchAccountByName(accounts: FinancialAccount[], name: string | null | undefined): string {
  const needle = (name ?? '').trim().toLowerCase()
  if (!needle) return ''
  const active = accounts.filter((a) => a.isActive)
  const exact = active.find((a) => a.name.toLowerCase() === needle)
  if (exact) return exact.id
  const partial = active.find((a) => a.name.toLowerCase().includes(needle) || needle.includes(a.name.toLowerCase()) || a.institution?.toLowerCase() === needle)
  return partial?.id ?? ''
}
