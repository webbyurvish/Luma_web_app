import type { AccountType, FinancialAccount, Investment, InvestmentType, Liability, SIP } from '@/types'

const CASH_AND_BANK_TYPES: AccountType[] = ['bank', 'cash', 'wallet']

export function getCashAndBankTotal(accounts: FinancialAccount[]): number {
  return accounts.filter((a) => a.isActive && CASH_AND_BANK_TYPES.includes(a.type)).reduce((sum, a) => sum + a.balance, 0)
}

export function getOtherAccountAssetsTotal(accounts: FinancialAccount[]): number {
  return accounts.filter((a) => a.isActive && (a.type === 'demat' || a.type === 'other')).reduce((sum, a) => sum + a.balance, 0)
}

export function getCreditCardOutstanding(accounts: FinancialAccount[]): number {
  return accounts.filter((a) => a.isActive && a.type === 'credit_card').reduce((sum, a) => sum + a.balance, 0)
}

export function getLiabilitiesTotal(liabilities: Liability[], accounts: FinancialAccount[]): number {
  return getCreditCardOutstanding(accounts) + liabilities.reduce((sum, l) => sum + l.amount, 0)
}

export interface InvestmentTotals {
  invested: number
  current: number
  gain: number
  returnPct: number
}

export function getInvestmentTotals(investments: Investment[]): InvestmentTotals {
  const invested = investments.reduce((sum, i) => sum + i.investedAmount, 0)
  const current = investments.reduce((sum, i) => sum + i.currentValue, 0)
  const gain = current - invested
  const returnPct = invested > 0 ? (gain / invested) * 100 : 0
  return { invested, current, gain, returnPct }
}

export interface NetWorthInput {
  accounts: FinancialAccount[]
  investments: Investment[]
  liabilities: Liability[]
  udhaarReceivable: number
}

export interface NetWorthBreakdown {
  cashAndBank: number
  investments: number
  otherAssets: number
  udhaarReceivable: number
  liabilities: number
  netWorth: number
}

export function getNetWorth({ accounts, investments, liabilities, udhaarReceivable }: NetWorthInput): NetWorthBreakdown {
  const cashAndBank = getCashAndBankTotal(accounts)
  const otherAssets = getOtherAccountAssetsTotal(accounts)
  const { current } = getInvestmentTotals(investments)
  const liabilitiesTotal = getLiabilitiesTotal(liabilities, accounts)
  const netWorth = cashAndBank + otherAssets + current + udhaarReceivable - liabilitiesTotal

  return { cashAndBank, investments: current, otherAssets, udhaarReceivable, liabilities: liabilitiesTotal, netWorth }
}

const INVESTMENT_TYPE_LABEL: Record<InvestmentType, string> = {
  mutual_fund: 'Mutual Funds',
  stock: 'Stocks',
  fixed_deposit: 'Fixed Deposits',
  gold: 'Gold',
  bond: 'Bonds',
  other: 'Other',
}

export interface AllocationSlice {
  key: string
  label: string
  value: number
  color: string
}

const ALLOCATION_COLORS: Record<string, string> = {
  'Cash & Bank': 'var(--color-success)',
  'Mutual Funds': 'var(--color-rust)',
  Stocks: 'var(--color-ai)',
  'Fixed Deposits': 'var(--color-warning)',
  Gold: 'var(--color-pink)',
  Bonds: 'var(--color-cyan)',
  'Udhaar Receivable': 'var(--color-info)',
  Other: 'var(--color-ink-muted)',
}

/** Net-worth asset allocation — distinct from expense-category breakdowns elsewhere in the app. */
export function getAssetAllocation(input: NetWorthInput): AllocationSlice[] {
  const byType = new Map<string, number>()
  const add = (label: string, amount: number) => {
    if (amount <= 0) return
    byType.set(label, (byType.get(label) ?? 0) + amount)
  }

  add('Cash & Bank', getCashAndBankTotal(input.accounts))
  add('Other', getOtherAccountAssetsTotal(input.accounts))
  for (const investment of input.investments) {
    add(INVESTMENT_TYPE_LABEL[investment.type], investment.currentValue)
  }
  add('Udhaar Receivable', input.udhaarReceivable)

  return Array.from(byType.entries())
    .map(([label, value]) => ({ key: label, label, value, color: ALLOCATION_COLORS[label] ?? 'var(--color-ink-muted)' }))
    .sort((a, b) => b.value - a.value)
}

export function getInvestmentTypeAllocation(investments: Investment[]): AllocationSlice[] {
  const byType = new Map<string, number>()
  for (const investment of investments) {
    const label = INVESTMENT_TYPE_LABEL[investment.type]
    byType.set(label, (byType.get(label) ?? 0) + investment.currentValue)
  }
  return Array.from(byType.entries())
    .map(([label, value]) => ({ key: label, label, value, color: ALLOCATION_COLORS[label] ?? 'var(--color-ink-muted)' }))
    .sort((a, b) => b.value - a.value)
}

function monthlyEquivalent(sip: SIP): number {
  return sip.frequency === 'monthly' ? sip.amount : sip.amount / 3
}

export function getMonthlySipTotal(sips: SIP[]): number {
  return sips.filter((s) => s.isActive).reduce((sum, s) => sum + monthlyEquivalent(s), 0)
}

export function getActiveSipCount(sips: SIP[]): number {
  return sips.filter((s) => s.isActive).length
}

export interface UpcomingSip {
  sip: SIP
  nextDate: string
}

/** `month` is 1-indexed here (1 = January) — formats straight to a YYYY-MM-DD key with correct year rollover. */
function toDateKey(year: number, month: number, day: number): string {
  const rolledYear = year + Math.floor((month - 1) / 12)
  const rolledMonth = ((month - 1) % 12) + 1
  return `${rolledYear}-${String(rolledMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Computes each active SIP's next debit date relative to `fromDate` (YYYY-MM-DD), soonest first. */
export function getUpcomingSips(sips: SIP[], fromDate: string, count = 5): UpcomingSip[] {
  // Parse as plain calendar components — never round-trip through Date/toISOString,
  // which shifts by a day whenever the browser's local timezone is behind UTC.
  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number)

  const withDates = sips
    .filter((s) => s.isActive && s.debitDay)
    .map((sip) => {
      const day = Math.min(sip.debitDay as number, 28)
      const nextDate = day >= fromDay ? toDateKey(fromYear, fromMonth, day) : toDateKey(fromYear, fromMonth + 1, day)
      return { sip, nextDate }
    })

  return withDates.sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1)).slice(0, count)
}

export interface SipGroup {
  key: string
  label: string
  amount: number
}

export function getSipsByPlatform(sips: SIP[], accounts: FinancialAccount[]): SipGroup[] {
  const nameOf = (id?: string) => accounts.find((a) => a.id === id)?.name ?? 'Unassigned'
  const byPlatform = new Map<string, number>()
  for (const sip of sips.filter((s) => s.isActive)) {
    const label = nameOf(sip.platformAccountId)
    byPlatform.set(label, (byPlatform.get(label) ?? 0) + monthlyEquivalent(sip))
  }
  return Array.from(byPlatform.entries())
    .map(([label, amount]) => ({ key: label, label, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export function getSipsByFund(sips: SIP[]): SipGroup[] {
  return sips
    .filter((s) => s.isActive)
    .map((s) => ({ key: s.id, label: s.fundName, amount: monthlyEquivalent(s) }))
    .sort((a, b) => b.amount - a.amount)
}
