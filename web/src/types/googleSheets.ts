import type { RawBill, RawBudget } from './planning'

/** Raw transaction row exactly as the Google Apps Script Web App returns it.
 *  id/status/voidedAt are only populated once the sheet's lifecycle columns
 *  exist (backfillTransactionIds()) — id falls back to "" on older rows. */
export interface RawTransaction {
  timestamp: string
  date: string
  amount: number
  type: string
  category: string
  subcategory: string
  paymentMethod: string
  merchant: string
  note: string
  month: string
  id?: string
  status?: string
  voidedAt?: string | null
  accountId?: string | null
  toAccountId?: string | null
}

export interface TransactionsApiResponse {
  success: boolean
  count?: number
  transactions?: RawTransaction[]
  error?: string
}

export interface HealthCheckResponse {
  success: boolean
  message?: string
  error?: string
}

/** Shared envelope every `?action=<entity>` list endpoint returns: `{ success, count, data }`. */
export interface ListApiResponse<T> {
  success: boolean
  count?: number
  data?: T[]
  error?: string
}

/**
 * Shared envelope a `?action=<entity>` POST returns. Apps Script's POST responses go
 * through a redirect chain that browsers/curl can't reliably follow back to JSON — the
 * write itself still lands in the sheet, but this response body should be treated as
 * best-effort, not the source of truth. Callers must re-fetch the list to confirm.
 */
export interface CreateApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/** Sheet row shape for ?action=accounts. */
export interface RawAccount {
  accountId: string
  accountName: string | null
  accountType: string | null
  institution: string | null
  accountNumberLast4: string | null
  openingBalance: number | null
  currentBalance: number | null
  currency: string | null
  isActive: boolean | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** Sheet row shape for ?action=investments. */
export interface RawInvestment {
  investmentId: string
  investmentName: string | null
  investmentType: string | null
  platform: string | null
  accountId: string | null
  investedAmount: number | null
  currentValue: number | null
  quantity: number | null
  averagePrice: number | null
  currentPrice: number | null
  purchaseDate: string | null
  saleValue: number | null
  realizedGain: number | null
  unrealizedGain: number | null
  currency: string | null
  status: string | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** Sheet row shape for ?action=sips. */
export interface RawSip {
  sipId: string
  sipName: string | null
  fundName: string | null
  investmentType: string | null
  platform: string | null
  accountId: string | null
  amount: number | null
  frequency: string | null
  debitDay: number | null
  startDate: string | null
  endDate: string | null
  category: string | null
  isActive: boolean | null
  lastPaymentDate: string | null
  nextPaymentDate: string | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** Sheet row shape for ?action=notes. Tags are stored as one comma-separated cell. */
export interface RawNote {
  noteId: string
  title: string | null
  content: string | null
  category: string | null
  tags: string | null
  isPinned: boolean | null
  isArchived: boolean | null
  createdAt: string | null
  updatedAt: string | null
}

/** Sheet row shape for ?action=liabilities. */
export interface RawLiability {
  liabilityId: string
  name: string | null
  type: string | null
  institution: string | null
  originalAmount: number | null
  outstandingAmount: number | null
  interestRate: number | null
  emiAmount: number | null
  dueDate: string | null
  accountId: string | null
  status: string | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}

/**
 * `?action=bootstrap` — every first-paint collection from one Apps Script execution.
 * A collection that failed server-side is absent from `data` and named in `errors`;
 * the client then fetches just that one through its own route.
 */
export interface BootstrapApiResponse {
  success: boolean
  data?: Partial<{
    accounts: RawAccount[]
    investments: RawInvestment[]
    sips: RawSip[]
    liabilities: RawLiability[]
    transactions: RawTransaction[]
    udhaar: RawUdhaar[]
    tasks: RawTask[]
    bills: RawBill[]
    budgets: RawBudget[]
  }>
  errors?: Record<string, string>
  error?: string
}

/** Sheet row shape for ?action=udhaar — one ledger entry (a "Given" or a "Repayment"). */
export interface RawUdhaar {
  udhaarId: string | null
  timestamp: string | null
  date: string | null
  person: string | null
  type: string | null
  amount: number | string | null
  description: string | null
  dueDate: string | null
  paymentMethod: string | null
  note: string | null
  isArchived?: boolean | null
  accountId?: string | null
}

/** Sheet row shape for ?action=tasks. */
export interface RawTask {
  taskId: string
  title: string | null
  description: string | null
  status: string | null
  priority: string | null
  dueDate: string | null
  category: string | null
  tags: string | null
  isCompleted: boolean | string | null
  createdAt: string | null
  completedAt: string | null
}
