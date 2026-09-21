import { useEffect, useState } from 'react'
import { CirclePlus, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { BalanceHeroCard } from '@/components/dashboard/BalanceHeroCard'
import { KPICard } from '@/components/dashboard/KPICard'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import { CategoryChart } from '@/components/dashboard/CategoryChart'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { AIInsightCard } from '@/components/dashboard/AIInsightCard'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { UdhaarPreview } from '@/components/dashboard/UdhaarPreview'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { QuickActionModal } from '@/components/common/QuickActionModal'
import { KPICardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockFinanceSummary, mockMonthlySpending } from '@/data/mockExpenses'

export function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  const incomeTrend = mockMonthlySpending.map((p) => p.income)
  const expenseTrend = mockMonthlySpending.map((p) => p.expense)

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Good evening, Urvish 👋</h2>
          <p className="text-sm text-ink-soft">Here's what's happening with your finances.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector />
          <Button icon={<CirclePlus size={16} />} onClick={() => setAddExpenseOpen(true)}>
            Add Expense
          </Button>
        </div>
      </div>

      {/* Row 1 — hero balance + income/expense */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {loading ? <KPICardSkeleton /> : <BalanceHeroCard />}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {loading ? (
            <>
              <KPICardSkeleton />
              <KPICardSkeleton />
            </>
          ) : (
            <>
              <KPICard
                label="Total Income"
                value={formatCurrency(mockFinanceSummary.totalIncome)}
                trend={mockFinanceSummary.incomeTrend}
                icon={<TrendingUp size={16} />}
                accent="success"
                sparkline={incomeTrend}
                index={0}
              />
              <KPICard
                label="Total Expense"
                value={formatCurrency(mockFinanceSummary.totalExpense)}
                trend={mockFinanceSummary.expenseTrend}
                icon={<TrendingDown size={16} />}
                accent="danger"
                sparkline={expenseTrend}
                index={1}
              />
            </>
          )}
        </div>
      </div>

      {/* Row 2 — spending visualization + category breakdown */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SpendingChart loading={loading} />
        </div>
        <CategoryChart loading={loading} />
      </div>

      {/* Row 3 — activity + quick actions / assistant */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentActivity loading={loading} />
        </div>
        <div className="flex flex-col gap-5">
          <QuickActions />
          <AIInsightCard />
        </div>
      </div>

      {/* Row 4 — transactions + udhaar */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentTransactions />
        </div>
        <UdhaarPreview />
      </div>

      <QuickActionModal open={addExpenseOpen} kind="expense" onClose={() => setAddExpenseOpen(false)} />
    </div>
  )
}
