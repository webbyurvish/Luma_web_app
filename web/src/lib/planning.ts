import { str } from '@/lib/sheetValues'
import type { Bill, BillFrequency, BillInput, Budget, BudgetInput, RawBill, RawBudget, Transaction } from '@/types'

export const BILL_FREQUENCIES: BillFrequency[] = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'Weekly', 'One-time']

/** Monthly equivalent, for "bills per month" totals. */
const PER_MONTH: Record<BillFrequency, number> = { Weekly: 52 / 12, Monthly: 1, Quarterly: 1 / 3, 'Half-yearly': 1 / 6, Yearly: 1 / 12, 'One-time': 0 }

function bool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value
  const s = str(value).trim().toLowerCase()
  if (s === 'false' || s === 'no') return false
  if (s === 'true' || s === 'yes') return true
  return fallback
}

function frequencyOf(value: unknown): BillFrequency {
  const s = str(value).trim().toLowerCase()
  return BILL_FREQUENCIES.find((f) => f.toLowerCase() === s) ?? 'Monthly'
}

export function normalizeBill(raw: RawBill): Bill {
  return {
    id: str(raw.billId),
    name: str(raw.name) || 'Bill',
    amount: Number(raw.amount) || 0,
    category: str(raw.category) || 'Bills',
    paymentMethod: str(raw.paymentMethod),
    accountId: str(raw.accountId) || undefined,
    frequency: frequencyOf(raw.frequency),
    nextDueDate: str(raw.nextDueDate).slice(0, 10),
    remindDaysBefore: raw.remindDaysBefore === null || raw.remindDaysBefore === undefined ? 3 : Number(raw.remindDaysBefore) || 0,
    isActive: bool(raw.isActive),
    lastPaidDate: str(raw.lastPaidDate).slice(0, 10) || undefined,
    notes: str(raw.notes) || undefined,
  }
}

export function normalizeBudget(raw: RawBudget): Budget {
  return {
    id: str(raw.budgetId),
    category: str(raw.category),
    monthlyLimit: Number(raw.monthlyLimit) || 0,
    alertAtPercent: Number(raw.alertAtPercent) || 80,
    isActive: bool(raw.isActive),
    notes: str(raw.notes) || undefined,
  }
}

export function buildBillPayload(input: Partial<BillInput>): Record<string, unknown> {
  return { ...input }
}

export function buildBudgetPayload(input: Partial<BudgetInput>): Record<string, unknown> {
  return { ...input }
}

/* ---------------------------------------------------------------- bills */

export type BillState = 'overdue' | 'today' | 'soon' | 'later' | 'paused'

function dayDiff(fromIso: string, toIso: string): number {
  const [a, b] = [fromIso, toIso].map((d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))))
  return Math.round((b - a) / 86_400_000)
}

/** Days until due (negative = overdue) and how urgent that is. */
export function billStatus(bill: Bill, today: string): { state: BillState; days: number } {
  if (!bill.isActive || !bill.nextDueDate) return { state: 'paused', days: 0 }
  const days = dayDiff(today, bill.nextDueDate)
  if (days < 0) return { state: 'overdue', days }
  if (days === 0) return { state: 'today', days }
  if (days <= bill.remindDaysBefore) return { state: 'soon', days }
  return { state: 'later', days }
}

export function dueLabel(days: number): string {
  if (days < -1) return `${-days} days overdue`
  if (days === -1) return '1 day overdue'
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

export function monthlyBillTotal(bills: Bill[]): number {
  return bills.filter((b) => b.isActive).reduce((sum, b) => sum + b.amount * PER_MONTH[b.frequency], 0)
}

/* -------------------------------------------------------------- budgets */

export interface BudgetUsage {
  budget: Budget
  spent: number
  /** 0–∞; 1 = exactly at the limit. */
  ratio: number
  state: 'ok' | 'warn' | 'over'
  /** What's left this month (negative when over). */
  left: number
}

/** Spending per budget for one month ("yyyy-MM"), matched on category name (case-insensitive). */
export function budgetUsage(budgets: Budget[], transactions: Transaction[], month: string): BudgetUsage[] {
  const spent = new Map<string, number>()
  transactions.forEach((t) => {
    if (t.type !== 'expense' || !t.date.startsWith(month)) return
    const key = (t.rawCategory ?? t.category).trim().toLowerCase()
    spent.set(key, (spent.get(key) ?? 0) + t.amount)
  })
  return budgets
    .filter((b) => b.isActive)
    .map((budget) => {
      const used = spent.get(budget.category.trim().toLowerCase()) ?? 0
      const ratio = budget.monthlyLimit > 0 ? used / budget.monthlyLimit : 0
      const state: BudgetUsage['state'] = ratio >= 1 ? 'over' : ratio * 100 >= budget.alertAtPercent ? 'warn' : 'ok'
      return { budget, spent: used, ratio, state, left: budget.monthlyLimit - used }
    })
    .sort((a, b) => b.ratio - a.ratio)
}
