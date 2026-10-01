export type FinanceTab = 'overview' | 'accounts' | 'bills' | 'budgets' | 'investments' | 'sips'

export const FINANCE_TABS: { id: FinanceTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'bills', label: 'Bills' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'investments', label: 'Investments' },
  { id: 'sips', label: 'SIPs' },
]
