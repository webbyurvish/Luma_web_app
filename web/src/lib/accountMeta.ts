import { Banknote, Building2, CreditCard, Landmark, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'
import type { AccountType } from '@/types'

export interface AccountTypeMeta {
  label: string
  pluralLabel: string
  icon: LucideIcon
}

export const ACCOUNT_TYPE_META: Record<AccountType, AccountTypeMeta> = {
  bank: { label: 'Bank', pluralLabel: 'Bank Accounts', icon: Landmark },
  cash: { label: 'Cash', pluralLabel: 'Cash', icon: Banknote },
  wallet: { label: 'Wallet', pluralLabel: 'Wallets', icon: Wallet },
  credit_card: { label: 'Credit Card', pluralLabel: 'Credit Cards', icon: CreditCard },
  demat: { label: 'Demat / Broker', pluralLabel: 'Demat & Broker Accounts', icon: Building2 },
  other: { label: 'Other', pluralLabel: 'Other Assets', icon: PiggyBank },
}

export const ACCOUNT_TYPE_OPTIONS = (Object.keys(ACCOUNT_TYPE_META) as AccountType[]).map((value) => ({
  value,
  label: ACCOUNT_TYPE_META[value].label,
}))
