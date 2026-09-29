import { useMemo, useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { MonthSelector, monthValueToKey, type MonthValue } from '@/components/dashboard/MonthSelector'
import { OverviewBand } from '@/components/dashboard/OverviewBand'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import { CategoryDonut } from '@/components/dashboard/CategoryDonut'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { AIInsightCard } from '@/components/dashboard/AIInsightCard'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { UdhaarPreview } from '@/components/dashboard/UdhaarPreview'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { FinanceSnapshotCard } from '@/components/dashboard/FinanceSnapshotCard'
import { QuickActionModal } from '@/components/common/QuickActionModal'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { useTransactions } from '@/hooks/useTransactions'
import { currentIstMonth } from '@/lib/formatDate'
import {
  buildFinanceSummary,
  calculateCategorySpending,
  calculateMonthlySpending,
  calculateWeeklySpending,
} from '@/lib/transactionCalculations'
import { mockUdhaarSummary } from '@/data/mockUdhaar'

function previousMonth({ monthIndex, year }: MonthValue): MonthValue {
  return monthIndex === 0 ? { monthIndex: 11, year: year - 1 } : { monthIndex: monthIndex - 1, year }
}

export function Dashboard() {
  const { transactions, loading, error, refetch } = useTransactions()
  const [selectedMonth, setSelectedMonth] = useState<MonthValue>(() => currentIstMonth())
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)

  const selectedMonthKey = monthValueToKey(selectedMonth)
  const previousMonthKey = monthValueToKey(previousMonth(selectedMonth))

  const monthTransactions = useMemo(() => transactions.filter((t) => t.month === selectedMonthKey), [transactions, selectedMonthKey])
  const previousMonthTransactions = useMemo(
    () => transactions.filter((t) => t.month === previousMonthKey),
    [transactions, previousMonthKey],
  )

  const summary = useMemo(
    () => buildFinanceSummary(monthTransactions, previousMonthTransactions, { udhaarReceivable: mockUdhaarSummary.toReceive }),
    [monthTransactions, previousMonthTransactions],
  )
  const categorySpending = useMemo(() => calculateCategorySpending(monthTransactions), [monthTransactions])
  const weeklySpending = useMemo(() => calculateWeeklySpending(transactions), [transactions])
  const monthlySpending = useMemo(() => calculateMonthlySpending(transactions), [transactions])

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg italic text-ink">Good evening, Urvish</h2>
          <p className="text-xs text-ink-soft">Here's what's happening with your finances.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
          <Button size="sm" icon={<CirclePlus size={13} />} onClick={() => setAddExpenseOpen(true)}>
            Add Expense
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState title="Couldn't load your financial data." description={error} onRetry={refetch} />
      ) : (
        <>
          {loading ? <ChartCardSkeleton /> : <OverviewBand summary={summary} />}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <SpendingChart loading={loading} weeklyData={weeklySpending} monthlyData={monthlySpending} />
            </div>
            <CategoryDonut loading={loading} data={categorySpending} totalExpense={summary.totalExpense} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RecentActivity loading={loading} transactions={transactions} />
            </div>
            <div className="flex flex-col gap-4">
              <QuickActions />
              <AIInsightCard />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RecentTransactions transactions={transactions} loading={loading} />
            </div>
            <UdhaarPreview />
          </div>

          <FinanceSnapshotCard />
        </>
      )}

      <QuickActionModal open={addExpenseOpen} kind="expense" onClose={() => setAddExpenseOpen(false)} />
    </div>
  )
}
