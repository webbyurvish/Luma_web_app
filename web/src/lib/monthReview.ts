import { calculateCategorySpending } from '@/lib/transactionCalculations'
import { normalizeMerchant } from '@/lib/gpayImport'
import type { Transaction } from '@/types'

/**
 * "Where did the money go" for one month, compared with the month before — computed from the
 * transactions already loaded. Transfers move money between your own accounts and are left out.
 */

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return d.toISOString().slice(0, 7)
}

export function monthName(month: string, withYear = true): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
}

export interface CategoryLine {
  category: string
  amount: number
  previous: number
  color: string
  share: number
}

export interface PayeeLine {
  key: string
  name: string
  count: number
  amount: number
  average: number
}

export interface Change {
  label: string
  amount: number
  previous: number
  /** +0.3 = up 30% */
  ratio: number
}

export interface MonthReview {
  month: string
  spent: number
  received: number
  previousSpent: number
  count: number
  categories: CategoryLine[]
  payees: PayeeLine[]
  /** Frequent small payments (≥4 times, under ₹300 on average) — the ones nobody notices. */
  smallFrequent: PayeeLine[]
  /** Payees paid this month and not in the three months before. */
  newPayees: PayeeLine[]
  biggest: Transaction[]
  changes: Change[]
  /** Spend per day of the month (index 0 = 1st). */
  daily: number[]
}

const inMonth = (t: Transaction, month: string) => t.date.slice(0, 7) === month
const expenses = (list: Transaction[], month: string) => list.filter((t) => t.type === 'expense' && inMonth(t, month))

function byPayee(list: Transaction[]): PayeeLine[] {
  const map = new Map<string, PayeeLine>()
  list.forEach((t) => {
    const name = (t.merchant || t.rawSubcategory || t.rawCategory || 'Unknown').trim()
    const key = normalizeMerchant(name) || name.toLowerCase()
    const line = map.get(key) ?? { key, name, count: 0, amount: 0, average: 0 }
    line.count++
    line.amount += t.amount
    map.set(key, line)
  })
  return [...map.values()].map((p) => ({ ...p, average: p.amount / p.count })).sort((a, b) => b.amount - a.amount)
}

/** "Transport · Fuel" style label for the finer-grained comparison. */
const subLabel = (t: Transaction) => (t.rawSubcategory ? `${t.rawCategory || 'Other'} · ${t.rawSubcategory}` : t.rawCategory || 'Other')

function sumBy(list: Transaction[], label: (t: Transaction) => string): Map<string, number> {
  const map = new Map<string, number>()
  list.forEach((t) => map.set(label(t), (map.get(label(t)) ?? 0) + t.amount))
  return map
}

export function buildMonthReview(transactions: Transaction[], month: string): MonthReview {
  const prevMonth = shiftMonth(month, -1)
  const current = expenses(transactions, month)
  const previous = expenses(transactions, prevMonth)
  const spent = current.reduce((s, t) => s + t.amount, 0)
  const previousSpent = previous.reduce((s, t) => s + t.amount, 0)
  const received = transactions.filter((t) => t.type === 'income' && inMonth(t, month)).reduce((s, t) => s + t.amount, 0)

  const prevByCategory = sumBy(previous, (t) => t.rawCategory?.trim() || 'Other')
  const categories = calculateCategorySpending(current).map((c) => ({
    category: c.label,
    amount: c.amount,
    previous: prevByCategory.get(c.label) ?? 0,
    color: c.color,
    share: spent ? c.amount / spent : 0,
  }))

  const payees = byPayee(current)
  // Planned bills (electricity, recharges) aren't the leak this is about.
  const billLike = new Set(current.filter((t) => /bill|recharge|rent|emi|insurance/i.test(t.rawCategory ?? '')).map((t) => normalizeMerchant(t.merchant ?? '')))
  const smallFrequent = payees.filter((p) => p.count >= 4 && p.average < 300 && !billLike.has(p.key)).sort((a, b) => b.count - a.count)

  const earlier = new Set(
    byPayee(transactions.filter((t) => t.type === 'expense' && t.date.slice(0, 7) >= shiftMonth(month, -3) && t.date.slice(0, 7) < month)).map((p) => p.key),
  )
  const hasHistory = earlier.size > 0
  const newPayees = hasHistory ? payees.filter((p) => !earlier.has(p.key)) : []

  // Category / subcategory moves worth mentioning: at least 20% and ₹500 either way.
  const now = sumBy(current, subLabel)
  const before = sumBy(previous, subLabel)
  const changes: Change[] = []
  new Set([...now.keys(), ...before.keys()]).forEach((label) => {
    const amount = now.get(label) ?? 0
    const prev = before.get(label) ?? 0
    if (!prev || !amount) return
    const ratio = (amount - prev) / prev
    if (Math.abs(ratio) >= 0.2 && Math.abs(amount - prev) >= 500) changes.push({ label, amount, previous: prev, ratio })
  })
  changes.sort((a, b) => Math.abs(b.amount - b.previous) - Math.abs(a.amount - a.previous))

  const [y, m] = month.split('-').map(Number)
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const daily = Array.from({ length: days }, () => 0)
  current.forEach((t) => (daily[Number(t.date.slice(8, 10)) - 1] += t.amount))

  return {
    month,
    spent,
    received,
    previousSpent,
    count: current.length,
    categories,
    payees,
    smallFrequent,
    newPayees,
    biggest: [...current].sort((a, b) => b.amount - a.amount).slice(0, 5),
    changes: changes.slice(0, 6),
    daily,
  }
}

/** Months that have any transactions, newest first. */
export function monthsWithData(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map((t) => t.date.slice(0, 7)))].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort().reverse()
}
