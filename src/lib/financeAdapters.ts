import type {
  AccountType,
  FinancialAccount,
  Investment,
  InvestmentType,
  Liability,
  LiabilityType,
  RawAccount,
  RawInvestment,
  RawLiability,
  RawSip,
  SIP,
  SIPFrequency,
} from '@/types'

const ACCOUNT_TYPE_MAP: Record<string, AccountType> = {
  bank: 'bank',
  cash: 'cash',
  wallet: 'wallet',
  'credit card': 'credit_card',
  demat: 'demat',
  'demat / broker': 'demat',
  broker: 'demat',
}

function normalizeAccountType(raw: string | null): AccountType {
  if (!raw) return 'other'
  return ACCOUNT_TYPE_MAP[raw.trim().toLowerCase()] ?? 'other'
}

const INVESTMENT_TYPE_MAP: Record<string, InvestmentType> = {
  stock: 'stock',
  ipo: 'stock',
  'mutual fund': 'mutual_fund',
  fd: 'fixed_deposit',
  'fixed deposit': 'fixed_deposit',
  gold: 'gold',
  bond: 'bond',
}

function normalizeInvestmentType(raw: string | null): InvestmentType {
  if (!raw) return 'other'
  return INVESTMENT_TYPE_MAP[raw.trim().toLowerCase()] ?? 'other'
}

const SIP_FREQUENCY_MAP: Record<string, SIPFrequency> = {
  monthly: 'monthly',
  quarterly: 'quarterly',
}

function normalizeSipFrequency(raw: string | null): SIPFrequency {
  if (!raw) return 'monthly'
  return SIP_FREQUENCY_MAP[raw.trim().toLowerCase()] ?? 'monthly'
}

const LIABILITY_TYPE_MAP: Record<string, LiabilityType> = {
  'credit card': 'credit_card',
  loan: 'loan',
  'personal loan': 'loan',
  'home loan': 'loan',
  'car loan': 'loan',
}

function normalizeLiabilityType(raw: string | null): LiabilityType {
  if (!raw) return 'other'
  return LIABILITY_TYPE_MAP[raw.trim().toLowerCase()] ?? 'other'
}

/** Reverse of the maps above — the Title Case labels the sheet's own dropdowns use (per ?action=lists). */
const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  wallet: 'Wallet',
  credit_card: 'Credit Card',
  demat: 'Demat',
  other: 'Other',
}

const INVESTMENT_TYPE_LABEL: Record<InvestmentType, string> = {
  stock: 'Stock',
  mutual_fund: 'Mutual Fund',
  fixed_deposit: 'FD',
  gold: 'Gold',
  bond: 'Bond',
  other: 'Other',
}

const SIP_FREQUENCY_LABEL: Record<SIPFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

const LIABILITY_TYPE_LABEL: Record<LiabilityType, string> = {
  credit_card: 'Credit Card',
  loan: 'Personal Loan',
  other: 'Other',
}

export function normalizeAccount(raw: RawAccount): FinancialAccount {
  const now = new Date().toISOString()
  return {
    id: raw.accountId,
    name: raw.accountName?.trim() || raw.institution?.trim() || 'Unnamed account',
    type: normalizeAccountType(raw.accountType),
    institution: raw.institution?.trim() || undefined,
    accountNumberLast4: raw.accountNumberLast4?.trim() || undefined,
    balance: raw.currentBalance ?? raw.openingBalance ?? 0,
    currency: raw.currency?.trim() || 'INR',
    isActive: raw.isActive ?? true,
    notes: raw.notes?.trim() || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
  }
}

export function normalizeInvestment(raw: RawInvestment): Investment {
  const now = new Date().toISOString()
  return {
    id: raw.investmentId,
    name: raw.investmentName?.trim() || raw.platform?.trim() || 'Unnamed investment',
    type: normalizeInvestmentType(raw.investmentType),
    platformAccountId: raw.accountId?.trim() || undefined,
    investedAmount: raw.investedAmount ?? 0,
    currentValue: raw.currentValue ?? raw.investedAmount ?? 0,
    quantity: raw.quantity ?? undefined,
    averagePrice: raw.averagePrice ?? undefined,
    currentPrice: raw.currentPrice ?? undefined,
    purchaseDate: raw.purchaseDate ?? undefined,
    notes: raw.notes?.trim() || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
  }
}

export function normalizeSip(raw: RawSip): SIP {
  const now = new Date().toISOString()
  return {
    id: raw.sipId,
    name: raw.sipName?.trim() || raw.fundName?.trim() || 'Unnamed SIP',
    fundName: raw.fundName?.trim() || raw.sipName?.trim() || 'Unnamed fund',
    platformAccountId: raw.accountId?.trim() || undefined,
    amount: raw.amount ?? 0,
    frequency: normalizeSipFrequency(raw.frequency),
    debitDay: raw.debitDay ?? undefined,
    startDate: raw.startDate ?? undefined,
    endDate: raw.endDate ?? undefined,
    category: raw.category?.trim() || undefined,
    isActive: raw.isActive ?? true,
    notes: raw.notes?.trim() || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
  }
}

export function normalizeLiability(raw: RawLiability): Liability {
  const now = new Date().toISOString()
  return {
    id: raw.liabilityId,
    name: raw.name?.trim() || raw.institution?.trim() || 'Unnamed liability',
    type: normalizeLiabilityType(raw.type),
    amount: raw.outstandingAmount ?? raw.originalAmount ?? 0,
    notes: raw.notes?.trim() || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
  }
}

/** Builds the POST body for a new account, using the sheet's own Title Case field values. */
export function buildAccountPayload(input: {
  name: string
  type: AccountType
  institution?: string
  accountNumberLast4?: string
  balance: number
  currency: string
  notes?: string
}): Record<string, unknown> {
  return {
    accountName: input.name,
    accountType: ACCOUNT_TYPE_LABEL[input.type],
    institution: input.institution || undefined,
    accountNumberLast4: input.accountNumberLast4 || undefined,
    openingBalance: input.balance,
    currentBalance: input.balance,
    currency: input.currency,
    isActive: true,
    notes: input.notes || undefined,
  }
}

export function buildInvestmentPayload(input: {
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
}): Record<string, unknown> {
  return {
    investmentName: input.name,
    investmentType: INVESTMENT_TYPE_LABEL[input.type],
    accountId: input.platformAccountId || undefined,
    investedAmount: input.investedAmount,
    currentValue: input.currentValue,
    quantity: input.quantity ?? undefined,
    averagePrice: input.averagePrice ?? undefined,
    currentPrice: input.currentPrice ?? undefined,
    purchaseDate: input.purchaseDate || undefined,
    unrealizedGain: input.currentValue - input.investedAmount,
    status: 'Active',
    notes: input.notes || undefined,
  }
}

export function buildSipPayload(input: {
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
}): Record<string, unknown> {
  return {
    sipName: input.name,
    fundName: input.fundName,
    accountId: input.platformAccountId || undefined,
    amount: input.amount,
    frequency: SIP_FREQUENCY_LABEL[input.frequency],
    debitDay: input.debitDay ?? undefined,
    startDate: input.startDate || undefined,
    endDate: input.endDate || undefined,
    category: input.category || undefined,
    isActive: input.isActive,
    notes: input.notes || undefined,
  }
}

export function buildLiabilityPayload(input: { name: string; type: LiabilityType; amount: number; notes?: string }): Record<string, unknown> {
  return {
    name: input.name,
    type: LIABILITY_TYPE_LABEL[input.type],
    outstandingAmount: input.amount,
    originalAmount: input.amount,
    status: 'Active',
    notes: input.notes || undefined,
  }
}
