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
  /** Account the money left (expense, transfer) or entered (income). */
  accountId?: string
  /** Transfers only: the account the money moved to. */
  toAccountId?: string
  /** Statement reference (e.g. the UPI transaction ID of an imported Google Pay payment). */
  reference?: string
  /** Original, un-mapped category text from the data source — used for grouping so a real
   *  category the fixed CategoryId set doesn't recognize isn't lost inside "other". */
  rawCategory?: string
  rawSubcategory?: string
  merchant?: string
  note?: string
  /** Source-provided month bucket (e.g. "Sep-2026"), when available — avoids re-deriving
   *  month boundaries from a date string. */
  month?: string
  /** The backend's real Transaction ID (e.g. "TXN-000012"), distinct from `id` above which
   *  is a synthesized display/React key. Only present once the sheet row has been assigned
   *  one (via the backend's ID backfill) — undefined on older rows, which therefore can't
   *  be voided from the UI since void is id-based only. */
  sourceId?: string
}

/** Editable fields of a sheet transaction, in the backend's update payload shape. */
export interface TransactionUpdateInput {
  /** yyyy-MM-dd */
  date: string
  amount: number
  /** Sheet text: "Expense" | "Income" | "Transfer" */
  type: string
  category: string
  subcategory: string
  paymentMethod: string
  merchant: string
  note: string
  /** Linked account ('' to unlink). Moves that account's balance. */
  accountId?: string
  /** Transfers only: destination account. */
  toAccountId?: string
}
