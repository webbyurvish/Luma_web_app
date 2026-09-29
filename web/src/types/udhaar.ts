export type UdhaarStatus = 'due-soon' | 'overdue' | 'pending' | 'settled'

export type UdhaarEntryType = 'given' | 'repayment'

/** One row of the Udhaar sheet: money given to, or repaid by, one person. */
export interface UdhaarEntry {
  id: string
  person: string
  type: UdhaarEntryType
  amount: number
  /** yyyy-MM-dd */
  date: string
  /** yyyy-MM-dd, only meaningful on "given" entries */
  dueDate?: string
  description?: string
  paymentMethod?: string
  note?: string
}

export interface UdhaarEntryInput {
  person: string
  type: UdhaarEntryType
  amount: number
  date: string
  dueDate?: string
  description?: string
  paymentMethod?: string
  note?: string
}

/** Per-person balance, derived from that person's entries. */
export interface UdhaarPerson {
  id: string
  name: string
  given: number
  repaid: number
  outstanding: number
  /** Earliest due date among the person's "given" entries, when any has one. */
  dueDate?: string
  status: UdhaarStatus
  entries: UdhaarEntry[]
}

export interface UdhaarSummary {
  totalGiven: number
  totalRepaid: number
  toReceive: number
  overdue: number
}
