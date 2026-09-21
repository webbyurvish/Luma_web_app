import { useEffect, useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { OverviewBand } from '@/components/dashboard/OverviewBand'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import { CategoryBars } from '@/components/dashboard/CategoryBars'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { AIInsightCard } from '@/components/dashboard/AIInsightCard'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { UdhaarPreview } from '@/components/dashboard/UdhaarPreview'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { QuickActionModal } from '@/components/common/QuickActionModal'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { mockFinanceSummary } from '@/data/mockExpenses'

export function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg italic text-ink">Good evening, Urvish</h2>
          <p className="text-xs text-ink-soft">Here's what's happening with your finances.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <MonthSelector />
          <Button size="sm" icon={<CirclePlus size={13} />} onClick={() => setAddExpenseOpen(true)}>
            Add Expense
          </Button>
        </div>
      </div>

      {loading ? <ChartCardSkeleton /> : <OverviewBand summary={mockFinanceSummary} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SpendingChart loading={loading} />
        </div>
        <CategoryBars loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentActivity loading={loading} />
        </div>
        <div className="flex flex-col gap-4">
          <QuickActions />
          <AIInsightCard />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentTransactions />
        </div>
        <UdhaarPreview />
      </div>

      <QuickActionModal open={addExpenseOpen} kind="expense" onClose={() => setAddExpenseOpen(false)} />
    </div>
  )
}
