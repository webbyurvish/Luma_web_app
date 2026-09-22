// 'transfer' is reserved for money moved between the user's own accounts — it must
// never be counted as income/expense. No mock data uses it yet, but the type exists
// so account-aware transactions can be introduced later without a breaking change.
export type TransactionType = 'expense' | 'income' | 'udhaar' | 'transfer'

export type PaymentMethod = 'UPI' | 'Card' | 'Cash' | 'Bank Transfer' | 'Net Banking'

export type CategoryId =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'bills'
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
}
