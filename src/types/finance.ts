import type { PaymentMethod } from './transaction'

export interface FinanceSummary {
  currentBalance: number
  totalIncome: number
  totalExpense: number
  udhaarReceivable: number
  balanceTrend: number
  incomeTrend: number
  expenseTrend: number
  udhaarTrend: number
}

export interface SpendingPoint {
  label: string
  income: number
  expense: number
  date: string
}

export interface CategoryBreakdown {
  /** The real category text from the data source — not forced into the fixed CategoryId set. */
  category: string
  label: string
  amount: number
  color: string
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod
  amount: number
  percentage: number
  color: string
}

export interface SpendingInsight {
  headline: string
  detail: string
  trendPoints: number[]
  isMock: true
}
