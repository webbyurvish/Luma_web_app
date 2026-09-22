export type AccountType = 'bank' | 'cash' | 'wallet' | 'credit_card' | 'demat' | 'other'

export interface FinancialAccount {
  id: string
  name: string
  type: AccountType
  institution?: string
  accountNumberLast4?: string
  balance: number
  currency: string
  isActive: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface AccountInput {
  name: string
  type: AccountType
  institution?: string
  accountNumberLast4?: string
  balance: number
  currency: string
  notes?: string
}
