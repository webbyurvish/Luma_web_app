import { lazy, Suspense, useMemo, useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { MonthSelector, monthValueToKey, type MonthValue } from '@/components/dashboard/MonthSelector'
import { HomeHero } from '@/components/dashboard/HomeHero'
import { MoneyRiver } from '@/components/dashboard/MoneyRiver'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { AIInsightCard } from '@/components/dashboard/AIInsightCard'
import { UdhaarPreview } from '@/components/dashboard/UdhaarPreview'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { FinanceSnapshotCard } from '@/components/dashboard/FinanceSnapshotCard'
import { QuickActionModal } from '@/components/common/QuickActionModal'
import { QuickAddBar } from '@/components/ai/QuickAddBar'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'

// The charts library is the heaviest part of Home; the numbers render first, charts stream in.
const SpendingChart = lazy(() => import('@/components/dashboard/SpendingChart').then((m) => ({ default: m.SpendingChart })))
const CategoryDonut = lazy(() => import('@/components/dashboard/CategoryDonut').then((m) => ({ default: m.CategoryDonut })))
import { useTransactions } from '@/hooks/useTransactions'
import { currentIstMonth } from '@/lib/formatDate'
import {
  buildFinanceSummary,
  calculateCategorySpending,
  calculateMonthlySpending,
  calculateWeeklySpending,
} from '@/lib/transactionCalculations'
import { useUdhaar } from '@/hooks/useLifeCollections'

/** Greeting by the time in India, so it's right wherever the phone's clock is set. */
function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()))
  return hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function previousMonth({ monthIndex, year }: MonthValue): MonthValue {
  return monthIndex === 0 ? { monthIndex: 11, year: year - 1 } : { monthIndex: monthIndex - 1, year }
}

export function Dashboard() {
  const { transactions, loading, error, refetch } = useTransactions()
  const { summary: udhaarSummary } = useUdhaar()
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
    () => buildFinanceSummary(monthTransactions, previousMonthTransactions, { udhaarReceivable: udhaarSummary.toReceive }),
    [monthTransactions, previousMonthTransactions, udhaarSummary.toReceive],
  )
  const categorySpending = useMemo(() => calculateCategorySpending(monthTransactions), [monthTransactions])
  const weeklySpending = useMemo(() => calculateWeeklySpending(transactions), [transactions])
  const monthlySpending = useMemo(() => calculateMonthlySpending(transactions), [transactions])

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl italic text-ink">{greeting()}, Urvish</h2>
          <p className="text-xs text-ink-soft">Where your money stands, and what's coming.</p>
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
          <QuickAddBar />

          {loading ? (
            <ChartCardSkeleton />
          ) : (
            <HomeHero
              summary={summary}
              transactions={transactions}
              monthKey={`${selectedMonth.year}-${String(selectedMonth.monthIndex + 1).padStart(2, '0')}`}
              monthLabel={MONTH_NAMES[selectedMonth.monthIndex]}
            />
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <MoneyRiver transactions={transactions} loading={loading} />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <QuickActions />
              <AIInsightCard />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Suspense fallback={<ChartCardSkeleton />}>
                <SpendingChart loading={loading} weeklyData={weeklySpending} monthlyData={monthlySpending} />
              </Suspense>
            </div>
            <Suspense fallback={<ChartCardSkeleton />}>
              <CategoryDonut loading={loading} data={categorySpending} totalExpense={summary.totalExpense} />
            </Suspense>
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
