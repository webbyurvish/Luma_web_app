export type BillFrequency = 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-yearly' | 'Yearly' | 'One-time'

export interface Bill {
  id: string
  name: string
  amount: number
  category: string
  paymentMethod: string
  accountId?: string
  frequency: BillFrequency
  /** yyyy-MM-dd */
  nextDueDate: string
  remindDaysBefore: number
  isActive: boolean
  lastPaidDate?: string
  notes?: string
}

export interface BillInput {
  name: string
  amount: number
  category: string
  paymentMethod: string
  accountId: string
  frequency: BillFrequency
  nextDueDate: string
  remindDaysBefore: number
  isActive: boolean
  notes: string
}

export interface Budget {
  id: string
  category: string
  monthlyLimit: number
  alertAtPercent: number
  isActive: boolean
  notes?: string
}

export interface BudgetInput {
  category: string
  monthlyLimit: number
  alertAtPercent: number
  isActive: boolean
  notes: string
}

/** Rows as the script returns them (camelCased headers; dates as ISO strings). */
export interface RawBill {
  billId: string
  name: string | null
  amount: number | null
  category: string | null
  paymentMethod: string | null
  accountId: string | null
  frequency: string | null
  nextDueDate: string | null
  remindDaysBefore: number | null
  isActive: boolean | string | null
  lastPaidDate: string | null
  notes: string | null
}

export interface RawBudget {
  budgetId: string
  category: string | null
  monthlyLimit: number | null
  alertAtPercent: number | null
  isActive: boolean | string | null
  notes: string | null
}
