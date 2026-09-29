export type FinanceTab = 'overview' | 'accounts' | 'investments' | 'sips'

export const FINANCE_TABS: { id: FinanceTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'investments', label: 'Investments' },
  { id: 'sips', label: 'SIPs' },
]
