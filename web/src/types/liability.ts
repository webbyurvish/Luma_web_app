export type LiabilityType = 'credit_card' | 'loan' | 'other'

export interface Liability {
  id: string
  name: string
  type: LiabilityType
  amount: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface LiabilityInput {
  name: string
  type: LiabilityType
  amount: number
  notes?: string
}
