export interface Recharge {
  id: string
  person: string
  service: string
  provider: string
  number: string
  plan: string
  amount: number
  validityDays: number
  lastRechargedOn?: string
  /** yyyy-MM-dd */
  expiresOn: string
  remindDaysBefore: number
  isActive: boolean
  notes?: string
}

export interface RechargeInput {
  person: string
  service: string
  provider: string
  number: string
  plan: string
  amount: number
  validityDays: number
  expiresOn: string
  remindDaysBefore: number
  isActive: boolean
  notes: string
}

export interface RechargeLog {
  id: string
  rechargeId: string
  person: string
  service: string
  provider: string
  number: string
  rechargedOn: string
  amount: number
  plan: string
  validityDays: number
  validUntil: string
  paidVia: string
  expenseRecorded: boolean
}

export type Occasion = 'Birthday' | 'Anniversary' | 'Death Anniversary' | 'Other'

export interface ImportantDate {
  id: string
  person: string
  occasion: Occasion
  title: string
  /** yyyy-MM-dd (the original date; the year matters only when yearKnown) */
  date: string
  yearKnown: boolean
  remindDaysBefore: number
  notes?: string
}

export interface ImportantDateInput {
  person: string
  occasion: Occasion
  title: string
  date: string
  yearKnown: boolean
  remindDaysBefore: number
  notes: string
}

export interface RawRecharge {
  rechargeId: string
  person: string | null
  service: string | null
  provider: string | null
  number: string | number | null
  plan: string | null
  amount: number | null
  validityDays: number | null
  lastRechargedOn: string | null
  expiresOn: string | null
  remindDaysBefore: number | null
  isActive: boolean | string | null
  notes: string | null
}

export interface RawRechargeLog {
  logId: string
  rechargeId: string | null
  person: string | null
  service: string | null
  provider: string | null
  number: string | number | null
  rechargedOn: string | null
  amount: number | null
  plan: string | null
  validityDays: number | null
  validUntil: string | null
  paidVia: string | null
  expenseRecorded: boolean | string | null
}

export interface RawImportantDate {
  dateId: string
  person: string | null
  occasion: string | null
  title: string | null
  date: string | null
  yearKnown: boolean | string | null
  remindDaysBefore: number | null
  notes: string | null
}
