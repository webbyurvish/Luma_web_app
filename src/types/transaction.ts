export type TransactionType = 'expense' | 'income' | 'udhaar'

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
  payment: PaymentMethod
  amount: number
  status: TransactionStatus
}
