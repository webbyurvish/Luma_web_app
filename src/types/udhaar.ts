export type UdhaarStatus = 'due-soon' | 'overdue' | 'pending' | 'settled'

export interface UdhaarPerson {
  id: string
  name: string
  given: number
  repaid: number
  outstanding: number
  dueDate: string
  status: UdhaarStatus
}

export interface UdhaarSummary {
  totalGiven: number
  totalRepaid: number
  toReceive: number
  overdue: number
}
