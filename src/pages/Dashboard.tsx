import { useEffect, useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { KPIGrid } from '@/components/dashboard/KPIGrid'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import { CategoryChart } from '@/components/dashboard/CategoryChart'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { AIInsightCard } from '@/components/dashboard/AIInsightCard'
import { SpendingTrendCard } from '@/components/dashboard/SpendingTrendCard'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { UdhaarPreview } from '@/components/dashboard/UdhaarPreview'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { QuickActionModal } from '@/components/common/QuickActionModal'
import { mockFinanceSummary } from '@/data/mockExpenses'

export function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Good evening, Urvish 👋</h2>
          <p className="text-sm text-ink-soft">Here's what's happening with your finances.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector />
          <Button icon={<CirclePlus size={16} />} onClick={() => setAddExpenseOpen(true)}>
            Add Expense
          </Button>
        </div>
      </div>

      <KPIGrid summary={mockFinanceSummary} loading={loading} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SpendingChart loading={loading} />
        </div>
        <CategoryChart loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <QuickActions />
        <AIInsightCard />
        <SpendingTrendCard />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecentActivity loading={loading} />
        <UdhaarPreview />
      </div>

      <RecentTransactions />

      <QuickActionModal open={addExpenseOpen} kind="expense" onClose={() => setAddExpenseOpen(false)} />
    </div>
  )
}
