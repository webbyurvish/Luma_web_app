export type InvestmentType = 'mutual_fund' | 'stock' | 'fixed_deposit' | 'gold' | 'bond' | 'other'

export interface Investment {
  id: string
  name: string
  type: InvestmentType
  platformAccountId?: string
  investedAmount: number
  currentValue: number
  quantity?: number
  averagePrice?: number
  currentPrice?: number
  purchaseDate?: string
  notes?: string
  /** Mock monthly value trail ending at currentValue — demo data, not a real price history. */
  history?: number[]
  createdAt: string
  updatedAt: string
}

export interface InvestmentInput {
  name: string
  type: InvestmentType
  platformAccountId?: string
  investedAmount: number
  currentValue: number
  quantity?: number
  averagePrice?: number
  currentPrice?: number
  purchaseDate?: string
  notes?: string
}
