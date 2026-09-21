import type { CategoryId, PaymentMethod } from './transaction'

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
}

export interface CategoryBreakdown {
  category: CategoryId
  label: string
  amount: number
  color: string
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod
  amount: number
  percentage: number
}

export interface SpendingInsight {
  headline: string
  detail: string
  trendPoints: number[]
  isMock: true
}
