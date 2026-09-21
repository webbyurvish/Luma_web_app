import { HandCoins, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { KPICard } from './KPICard'
import { KPICardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockMonthlySpending } from '@/data/mockExpenses'
import type { FinanceSummary } from '@/types'

interface KPIGridProps {
  summary: FinanceSummary
  loading?: boolean
}

export function KPIGrid({ summary, loading }: KPIGridProps) {
  const incomeTrend = mockMonthlySpending.map((p) => p.income)
  const expenseTrend = mockMonthlySpending.map((p) => p.expense)

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
        sparkline={incomeTrend}
        index={0}
      />
      <KPICard
        label="Total Income"
        value={formatCurrency(summary.totalIncome)}
        trend={summary.incomeTrend}
        icon={<TrendingUp size={18} />}
        accent="success"
        sparkline={incomeTrend}
        index={1}
      />
      <KPICard
        label="Total Expense"
        value={formatCurrency(summary.totalExpense)}
        trend={summary.expenseTrend}
        icon={<TrendingDown size={18} />}
        accent="danger"
        sparkline={expenseTrend}
        index={2}
      />
      <KPICard
        label="Udhaar Receivable"
        value={formatCurrency(summary.udhaarReceivable)}
        trend={summary.udhaarTrend}
        icon={<HandCoins size={18} />}
        accent="ai"
        sparkline={expenseTrend.slice().reverse()}
        index={3}
      />
    </div>
  )
}
