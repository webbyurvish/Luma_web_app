import { HandCoins, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { KPICard } from './KPICard'
import { KPICardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import type { FinanceSummary } from '@/types'

interface KPIGridProps {
  summary: FinanceSummary
  loading?: boolean
}

export function KPIGrid({ summary, loading }: KPIGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <KPICardSkeleton key={index} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KPICard
        label="Current Balance"
        value={formatCurrency(summary.currentBalance)}
        trend={summary.balanceTrend}
        icon={<PiggyBank size={18} />}
        accent="gold"
      />
      <KPICard
        label="Total Income"
        value={formatCurrency(summary.totalIncome)}
        trend={summary.incomeTrend}
        icon={<TrendingUp size={18} />}
        accent="success"
      />
      <KPICard
        label="Total Expense"
        value={formatCurrency(summary.totalExpense)}
        trend={summary.expenseTrend}
        icon={<TrendingDown size={18} />}
        accent="danger"
      />
      <KPICard
        label="Udhaar Receivable"
        value={formatCurrency(summary.udhaarReceivable)}
        trend={summary.udhaarTrend}
        icon={<HandCoins size={18} />}
        accent="ai"
      />
    </div>
  )
}
