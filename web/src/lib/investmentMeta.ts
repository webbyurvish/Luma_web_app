import { Banknote, Building2, Coins, Landmark, LineChart, PiggyBank, type LucideIcon } from 'lucide-react'
import type { InvestmentType } from '@/types'

export interface InvestmentTypeMeta {
  label: string
  icon: LucideIcon
  color: string
}

export const INVESTMENT_TYPE_META: Record<InvestmentType, InvestmentTypeMeta> = {
  mutual_fund: { label: 'Mutual Fund', icon: PiggyBank, color: 'var(--color-chart-1)' },
  stock: { label: 'Stock', icon: LineChart, color: 'var(--color-chart-7)' },
  fixed_deposit: { label: 'Fixed Deposit', icon: Landmark, color: 'var(--color-chart-4)' },
  gold: { label: 'Gold', icon: Coins, color: 'var(--color-chart-2)' },
  bond: { label: 'Bond', icon: Building2, color: 'var(--color-chart-3)' },
  other: { label: 'Other', icon: Banknote, color: 'var(--color-ink-muted)' },
}

export const INVESTMENT_TYPE_OPTIONS = (Object.keys(INVESTMENT_TYPE_META) as InvestmentType[]).map((value) => ({
  value,
  label: INVESTMENT_TYPE_META[value].label,
}))
