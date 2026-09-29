import { useMemo } from 'react'
import { NetWorthPanel } from './NetWorthPanel'
import { AllocationDonut } from './AllocationDonut'
import { FinanceStatTile } from './FinanceStatTile'
import { UpcomingFinance } from './UpcomingFinance'
import { FinancialHealthSnapshot } from './FinancialHealthSnapshot'
import { OverviewBand } from '@/components/dashboard/OverviewBand'
import { CategoryDonut } from '@/components/dashboard/CategoryDonut'
import { IncomeExpenseChart } from './IncomeExpenseChart'
import { PaymentMethodChart } from './PaymentMethodChart'
import { ErrorState } from '@/components/ui/ErrorState'
import { ChartCardSkeleton, NetWorthPanelSkeleton, StatTileSkeleton } from '@/components/ui/Skeleton'
import { useAccounts, useInvestments, useLiabilities, useSips } from '@/hooks/useFinanceCollections'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCurrency } from '@/lib/formatCurrency'
import { getAssetAllocation, getInvestmentTotals, getMonthlySipTotal, getNetWorth } from '@/lib/financeCalculations'
import { currentIstMonth } from '@/lib/formatDate'
import { monthValueToKey } from '@/components/dashboard/MonthSelector'
import {
  buildFinanceSummary,
  calculateCategorySpending,
  calculateMonthlySpending,
  calculatePaymentMethodSpending,
} from '@/lib/transactionCalculations'
import { mockUdhaarSummary } from '@/data/mockUdhaar'
import type { FinanceTab } from './financeTabs'

interface FinanceOverviewProps {
  onSelectTab: (tab: FinanceTab) => void
}

export function FinanceOverview({ onSelectTab }: FinanceOverviewProps) {
  const { accounts, loading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAccounts()
  const { investments, loading: investmentsLoading, error: investmentsError, refetch: refetchInvestments } = useInvestments()
  const { sips, loading: sipsLoading, error: sipsError, refetch: refetchSips } = useSips()
  const { liabilities, loading: liabilitiesLoading, error: liabilitiesError, refetch: refetchLiabilities } = useLiabilities()
  const { transactions, loading, error, refetch } = useTransactions()

  const summaryLoading = accountsLoading || investmentsLoading || sipsLoading || liabilitiesLoading
  const summaryError = accountsError ?? investmentsError ?? sipsError ?? liabilitiesError
  const retrySummary = () => {
    refetchAccounts()
    refetchInvestments()
    refetchSips()
    refetchLiabilities()
  }

  const udhaarReceivable = mockUdhaarSummary.toReceive
  const netWorth = getNetWorth({ accounts, investments, liabilities, udhaarReceivable })
  const allocation = getAssetAllocation({ accounts, investments, liabilities, udhaarReceivable })
  const investmentTotals = getInvestmentTotals(investments)
  const monthlySip = getMonthlySipTotal(sips)

  const totalAssetsForRate = netWorth.cashAndBank + netWorth.investments + netWorth.otherAssets
  const investmentAllocationPct = totalAssetsForRate > 0 ? (netWorth.investments / totalAssetsForRate) * 100 : 0

  const currentMonth = currentIstMonth()
  const currentMonthKey = monthValueToKey(currentMonth)
  const previousMonthKey = monthValueToKey(
    currentMonth.monthIndex === 0 ? { monthIndex: 11, year: currentMonth.year - 1 } : { monthIndex: currentMonth.monthIndex - 1, year: currentMonth.year },
  )
  const monthTransactions = useMemo(() => transactions.filter((t) => t.month === currentMonthKey), [transactions, currentMonthKey])
  const previousMonthTransactions = useMemo(() => transactions.filter((t) => t.month === previousMonthKey), [transactions, previousMonthKey])
  const cashFlowSummary = useMemo(
    () => buildFinanceSummary(monthTransactions, previousMonthTransactions),
    [monthTransactions, previousMonthTransactions],
  )
  const categorySpending = useMemo(() => calculateCategorySpending(monthTransactions), [monthTransactions])
  const paymentSpending = useMemo(() => calculatePaymentMethodSpending(monthTransactions), [monthTransactions])
  const monthlySpending = useMemo(() => calculateMonthlySpending(transactions), [transactions])
  const savingsRate = cashFlowSummary.totalIncome > 0 ? ((cashFlowSummary.totalIncome - cashFlowSummary.totalExpense) / cashFlowSummary.totalIncome) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      {summaryError ? (
        <ErrorState title="Couldn't load your financial summary." description={summaryError} onRetry={retrySummary} />
      ) : (
        <>
          {summaryLoading ? <NetWorthPanelSkeleton /> : <NetWorthPanel breakdown={netWorth} />}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {summaryLoading ? (
              [0, 1, 2].map((i) => <StatTileSkeleton key={i} />)
            ) : (
              <>
                <FinanceStatTile
                  label="Cash & Bank"
                  value={formatCurrency(netWorth.cashAndBank, { compact: true })}
                  onClick={() => onSelectTab('accounts')}
                />
                <FinanceStatTile
                  label="Investments"
                  value={formatCurrency(investmentTotals.current, { compact: true })}
                  onClick={() => onSelectTab('investments')}
                />
                <FinanceStatTile label="Monthly SIP" value={formatCurrency(monthlySip, { compact: true })} onClick={() => onSelectTab('sips')} />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {summaryLoading ? (
              <ChartCardSkeleton />
            ) : (
              <AllocationDonut title="Asset Allocation" subtitle="Where your net worth lives" data={allocation} centerLabel="Total Assets" />
            )}
            <UpcomingFinance />
          </div>

          <FinancialHealthSnapshot
            loading={summaryLoading}
            monthlySip={monthlySip}
            savingsRate={savingsRate}
            investmentAllocationPct={investmentAllocationPct}
            udhaarOutstanding={udhaarReceivable}
          />
        </>
      )}

      <div className="border-t border-border-soft pt-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">This month's cash flow</p>
        {error ? (
          <ErrorState title="Couldn't load your financial data." description={error} onRetry={refetch} />
        ) : loading ? (
          <ChartCardSkeleton />
        ) : (
          <div className="flex flex-col gap-4">
            <OverviewBand summary={cashFlowSummary} showUdhaar={false} />
            <IncomeExpenseChart data={monthlySpending} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <CategoryDonut data={categorySpending} totalExpense={cashFlowSummary.totalExpense} />
              <PaymentMethodChart data={paymentSpending} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
