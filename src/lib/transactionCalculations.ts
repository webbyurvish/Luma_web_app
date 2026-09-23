import { CATEGORY_META } from './categoryMeta'
import { MONTH_ABBR, dateKeyToMonthLabel, todayIstDateKey, toIstDateKey } from './formatDate'
import type { CategoryBreakdown, FinanceSummary, PaymentMethodBreakdown, SpendingPoint, Transaction } from '@/types'

const CATEGORY_COLOR_FALLBACKS = [
  'var(--color-rust)',
  'var(--color-info)',
  'var(--color-pink)',
  'var(--color-warning)',
  'var(--color-cyan)',
  'var(--color-success)',
  'var(--color-ai)',
]

const PAYMENT_COLOR_MAP: Record<string, string> = {
  upi: 'var(--color-ai)',
  card: 'var(--color-rust)',
  'credit card': 'var(--color-rust)',
  'debit card': 'var(--color-rust-dark)',
  cash: 'var(--color-success)',
  'bank transfer': 'var(--color-warning)',
  'net banking': 'var(--color-pink)',
}

function isExpense(t: Transaction): boolean {
  return t.type === 'expense'
}

function isIncome(t: Transaction): boolean {
  return t.type === 'income'
}

export function calculateTotalIncome(transactions: Transaction[]): number {
  return transactions.filter(isIncome).reduce((sum, t) => sum + t.amount, 0)
}

export function calculateTotalExpense(transactions: Transaction[]): number {
  return transactions.filter(isExpense).reduce((sum, t) => sum + t.amount, 0)
}

export function calculateBalance(transactions: Transaction[]): number {
  return calculateTotalIncome(transactions) - calculateTotalExpense(transactions)
}

export function calculateTodayExpense(transactions: Transaction[]): number {
  const today = todayIstDateKey()
  return transactions.filter((t) => isExpense(t) && toIstDateKey(t.date) === today).reduce((sum, t) => sum + t.amount, 0)
}

const CATEGORY_META_ENTRIES = new Map<string, (typeof CATEGORY_META)[keyof typeof CATEGORY_META]>(
  Object.values(CATEGORY_META).map((meta) => [meta.id, meta]),
)

/** A deterministic color per category name so the same category always renders the same hue. */
function colorForCategory(name: string, knownIndex: Map<string, number>): string {
  const known = CATEGORY_META_ENTRIES.get(name.toLowerCase())
  if (known) return known.color
  if (!knownIndex.has(name)) knownIndex.set(name, knownIndex.size)
  return CATEGORY_COLOR_FALLBACKS[knownIndex.get(name)! % CATEGORY_COLOR_FALLBACKS.length]
}

/** Groups Expense transactions by their real sheet category — never collapsed to a fixed set. */
export function calculateCategorySpending(transactions: Transaction[]): CategoryBreakdown[] {
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (!isExpense(t)) continue
    const key = t.rawCategory?.trim() || 'Other'
    totals.set(key, (totals.get(key) ?? 0) + t.amount)
  }

  const fallbackIndex = new Map<string, number>()
  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, label: category, amount, color: colorForCategory(category, fallbackIndex) }))
    .sort((a, b) => b.amount - a.amount)
}

function colorForPaymentMethod(name: string): string {
  return PAYMENT_COLOR_MAP[name.trim().toLowerCase()] ?? 'var(--color-ink-muted)'
}

/** Groups Expense transactions by their real sheet payment method. */
export function calculatePaymentMethodSpending(transactions: Transaction[]): PaymentMethodBreakdown[] {
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (!isExpense(t)) continue
    const key = t.payment?.trim() || 'Other'
    totals.set(key, (totals.get(key) ?? 0) + t.amount)
  }

  const total = Array.from(totals.values()).reduce((sum, v) => sum + v, 0)
  return Array.from(totals.entries())
    .map(([method, amount]) => ({
      method,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      color: colorForPaymentMethod(method),
    }))
    .sort((a, b) => b.amount - a.amount)
}

/** Parses a "Sep-2026" month label (the adapter guarantees every transaction has one) into a sortable key + display date. */
function parseMonthLabel(label: string): { sortKey: number; date: string; short: string } | null {
  const match = /^([A-Za-z]{3})-(\d{4})$/.exec(label.trim())
  if (!match) return null
  const monthIndex = MONTH_ABBR.findIndex((m) => m.toLowerCase() === match[1].toLowerCase())
  if (monthIndex === -1) return null
  const year = Number(match[2])
  return { sortKey: year * 12 + monthIndex, date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`, short: MONTH_ABBR[monthIndex] }
}

/** Groups all transactions by the sheet's own `month` field, chronologically, last 7 months. */
export function calculateMonthlySpending(transactions: Transaction[]): SpendingPoint[] {
  const byMonth = new Map<string, { income: number; expense: number; sortKey: number; date: string; short: string }>()

  for (const t of transactions) {
    const monthLabel = t.month ?? dateKeyToMonthLabel(toIstDateKey(t.date))
    const parsed = parseMonthLabel(monthLabel)
    if (!parsed) continue
    const existing = byMonth.get(monthLabel) ?? { income: 0, expense: 0, ...parsed }
    if (isIncome(t)) existing.income += t.amount
    if (isExpense(t)) existing.expense += t.amount
    byMonth.set(monthLabel, existing)
  }

  return Array.from(byMonth.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(-7)
    .map((m) => ({ label: m.short, income: m.income, expense: m.expense, date: m.date }))
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Groups all transactions by calendar day for the last 7 days (Asia/Kolkata), oldest first. */
export function calculateWeeklySpending(transactions: Transaction[]): SpendingPoint[] {
  const todayKey = todayIstDateKey()
  const todayMs = Date.parse(`${todayKey}T00:00:00Z`)

  const days: { key: string; label: string; income: number; expense: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const ms = todayMs - i * 86_400_000
    const key = new Date(ms).toISOString().slice(0, 10)
    const weekday = WEEKDAY_LABELS[new Date(ms).getUTCDay()]
    days.push({ key, label: weekday, income: 0, expense: 0 })
  }
  const byKey = new Map(days.map((d) => [d.key, d]))

  for (const t of transactions) {
    const key = toIstDateKey(t.date)
    const bucket = byKey.get(key)
    if (!bucket) continue
    if (isIncome(t)) bucket.income += t.amount
    if (isExpense(t)) bucket.expense += t.amount
  }

  return days.map((d) => ({ label: d.label, income: d.income, expense: d.expense, date: d.key }))
}

/** Parses a "8:15 PM" display time into minutes-since-midnight for chronological sorting. */
function timeToMinutes(time: string): number {
  const match = /(\d{1,2}):(\d{2})\s?(AM|PM)/i.exec(time)
  if (!match) return 0
  let hours = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hours += 12
  return hours * 60 + Number(match[2])
}

/** Latest transactions, most recent first (by calendar date, then time-of-day). */
export function getRecentTransactions(transactions: Transaction[], count = 8): Transaction[] {
  return [...transactions]
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      return timeToMinutes(b.time) - timeToMinutes(a.time)
    })
    .slice(0, count)
}

/** Every distinct "Mon-YYYY" month present in the data, most recent first. */
export function getAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>()
  for (const t of transactions) {
    if (t.month) months.add(t.month)
  }
  return Array.from(months).sort((a, b) => {
    const pa = parseMonthLabel(a)
    const pb = parseMonthLabel(b)
    return (pb?.sortKey ?? 0) - (pa?.sortKey ?? 0)
  })
}

export interface BuildFinanceSummaryOptions {
  /** Carried over from the Udhaar module (out of scope for this integration) so OverviewBand keeps its existing card intact. */
  udhaarReceivable?: number
}

/**
 * Builds the FinanceSummary the existing OverviewBand expects. Trend percentages compare
 * the selected month's totals against the previous month when at least two months of real
 * data exist; otherwise they default to 0 rather than inventing a change that isn't real.
 */
export function buildFinanceSummary(
  currentMonthTransactions: Transaction[],
  previousMonthTransactions: Transaction[],
  options?: BuildFinanceSummaryOptions,
): FinanceSummary {
  const totalIncome = calculateTotalIncome(currentMonthTransactions)
  const totalExpense = calculateTotalExpense(currentMonthTransactions)
  const currentBalance = totalIncome - totalExpense

  const prevIncome = calculateTotalIncome(previousMonthTransactions)
  const prevExpense = calculateTotalExpense(previousMonthTransactions)
  const prevBalance = prevIncome - prevExpense
  const hasPrevious = previousMonthTransactions.length > 0

  const percentChange = (current: number, previous: number): number => {
    if (!hasPrevious || previous === 0) return 0
    return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
  }

  return {
    currentBalance,
    totalIncome,
    totalExpense,
    udhaarReceivable: options?.udhaarReceivable ?? 0,
    balanceTrend: percentChange(currentBalance, prevBalance),
    incomeTrend: percentChange(totalIncome, prevIncome),
    expenseTrend: percentChange(totalExpense, prevExpense),
    udhaarTrend: 0,
  }
}
