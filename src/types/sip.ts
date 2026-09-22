export type SIPFrequency = 'monthly' | 'quarterly'

export interface SIP {
  id: string
  name: string
  fundName: string
  platformAccountId?: string
  amount: number
  frequency: SIPFrequency
  debitDay?: number
  startDate?: string
  endDate?: string
  category?: string
  isActive: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface SIPInput {
  name: string
  fundName: string
  platformAccountId?: string
  amount: number
  frequency: SIPFrequency
  debitDay?: number
  startDate?: string
  endDate?: string
  category?: string
  isActive: boolean
  notes?: string
}
