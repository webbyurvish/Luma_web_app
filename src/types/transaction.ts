// 'transfer' is reserved for money moved between the user's own accounts — it must
// never be counted as income/expense. No mock data uses it yet, but the type exists
// so account-aware transactions can be introduced later without a breaking change.
export type TransactionType = 'expense' | 'income' | 'udhaar' | 'transfer'

// Widened from a closed union to plain strings: real transactions come from a Google
// Sheet where the payment method column is free text, so the app must render whatever
// value the sheet actually contains rather than force-fitting it into a fixed list.
export type PaymentMethod = string

export type CategoryId =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'bills'
  | 'home'
  | 'entertainment'
  | 'health'
  | 'income'
  | 'udhaar'
  | 'other'

export type TransactionStatus = 'successful' | 'pending' | 'failed'

export interface Transaction {
  id: string
  category: CategoryId
  description: string
  type: TransactionType
  date: string
  time: string
  payment: PaymentMethod
  amount: number
  status: TransactionStatus
  /** Which financial account this movement belongs to — optional so existing mock rows keep working. */
  accountId?: string
  /** Original, un-mapped category text from the data source — used for grouping so a real
   *  category the fixed CategoryId set doesn't recognize isn't lost inside "other". */
  rawCategory?: string
  rawSubcategory?: string
  merchant?: string
  note?: string
  /** Source-provided month bucket (e.g. "Sep-2026"), when available — avoids re-deriving
   *  month boundaries from a date string. */
  month?: string
}
