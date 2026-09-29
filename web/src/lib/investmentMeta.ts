import { Banknote, Building2, Coins, Landmark, LineChart, PiggyBank, type LucideIcon } from 'lucide-react'
import type { InvestmentType } from '@/types'

export interface InvestmentTypeMeta {
  label: string
  icon: LucideIcon
  color: string
}

export const INVESTMENT_TYPE_META: Record<InvestmentType, InvestmentTypeMeta> = {
  mutual_fund: { label: 'Mutual Fund', icon: PiggyBank, color: 'var(--color-rust)' },
  stock: { label: 'Stock', icon: LineChart, color: 'var(--color-ai)' },
  fixed_deposit: { label: 'Fixed Deposit', icon: Landmark, color: 'var(--color-warning)' },
  gold: { label: 'Gold', icon: Coins, color: 'var(--color-pink)' },
  bond: { label: 'Bond', icon: Building2, color: 'var(--color-cyan)' },
  other: { label: 'Other', icon: Banknote, color: 'var(--color-ink-muted)' },
}

export const INVESTMENT_TYPE_OPTIONS = (Object.keys(INVESTMENT_TYPE_META) as InvestmentType[]).map((value) => ({
  value,
  label: INVESTMENT_TYPE_META[value].label,
}))
