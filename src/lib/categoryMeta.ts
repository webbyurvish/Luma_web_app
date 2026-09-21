import {
  Car,
  Clapperboard,
  HandCoins,
  HeartPulse,
  type LucideIcon,
  MoreHorizontal,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import type { CategoryId } from '@/types'

export interface CategoryMeta {
  id: CategoryId
  label: string
  icon: LucideIcon
  color: string
  bg: string
}

export const CATEGORY_META: Record<CategoryId, CategoryMeta> = {
  food: { id: 'food', label: 'Food', icon: UtensilsCrossed, color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
  transport: { id: 'transport', label: 'Transport', icon: Car, color: 'var(--color-info)', bg: 'var(--color-info-soft)' },
  shopping: { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'var(--color-pink)', bg: 'var(--color-pink-soft)' },
  bills: { id: 'bills', label: 'Bills', icon: Receipt, color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
  entertainment: { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: 'var(--color-cyan)', bg: 'var(--color-cyan-soft)' },
  health: { id: 'health', label: 'Health', icon: HeartPulse, color: 'var(--color-green)', bg: 'var(--color-success-soft)' },
  income: { id: 'income', label: 'Income', icon: Wallet, color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  udhaar: { id: 'udhaar', label: 'Udhaar', icon: HandCoins, color: 'var(--color-ai)', bg: 'var(--color-ai-soft)' },
  other: { id: 'other', label: 'Other', icon: MoreHorizontal, color: 'var(--color-ink-soft)', bg: 'var(--color-bg-soft)' },
}
