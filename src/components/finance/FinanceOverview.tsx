import { NetWorthPanel } from './NetWorthPanel'
import { AllocationDonut } from './AllocationDonut'
import { FinanceStatTile } from './FinanceStatTile'
import { UpcomingFinance } from './UpcomingFinance'
import { FinancialHealthSnapshot } from './FinancialHealthSnapshot'
import { OverviewBand } from '@/components/dashboard/OverviewBand'
import { CategoryDonut } from '@/components/dashboard/CategoryDonut'
import { IncomeExpenseChart } from './IncomeExpenseChart'
import { PaymentMethodChart } from './PaymentMethodChart'
import { useAccounts, useInvestments, useLiabilities, useSips } from '@/hooks/useFinanceCollections'
import { formatCurrency } from '@/lib/formatCurrency'
import { getAssetAllocation, getInvestmentTotals, getMonthlySipTotal, getNetWorth } from '@/lib/financeCalculations'
import { mockFinanceSummary } from '@/data/mockExpenses'
import { mockUdhaarSummary } from '@/data/mockUdhaar'
import type { FinanceTab } from './financeTabs'

interface FinanceOverviewProps {
  onSelectTab: (tab: FinanceTab) => void
}

export function FinanceOverview({ onSelectTab }: FinanceOverviewProps) {
  const { accounts } = useAccounts()
  const { investments } = useInvestments()
  const { sips } = useSips()
  const { liabilities } = useLiabilities()

  const udhaarReceivable = mockUdhaarSummary.toReceive
  const netWorth = getNetWorth({ accounts, investments, liabilities, udhaarReceivable })
  const allocation = getAssetAllocation({ accounts, investments, liabilities, udhaarReceivable })
  const investmentTotals = getInvestmentTotals(investments)
  const monthlySip = getMonthlySipTotal(sips)

  const totalAssetsForRate = netWorth.cashAndBank + netWorth.investments + netWorth.otherAssets
  const investmentAllocationPct = totalAssetsForRate > 0 ? (netWorth.investments / totalAssetsForRate) * 100 : 0
  const savingsRate =
    mockFinanceSummary.totalIncome > 0
      ? ((mockFinanceSummary.totalIncome - mockFinanceSummary.totalExpense) / mockFinanceSummary.totalIncome) * 100
      : 0

  return (
    <div className="flex flex-col gap-4">
      <NetWorthPanel breakdown={netWorth} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AllocationDonut title="Asset Allocation" subtitle="Where your net worth lives" data={allocation} centerLabel="Total Assets" />
        <UpcomingFinance />
      </div>

      <FinancialHealthSnapshot
        monthlySip={monthlySip}
        savingsRate={savingsRate}
        investmentAllocationPct={investmentAllocationPct}
        udhaarOutstanding={udhaarReceivable}
      />

      <div className="border-t border-border-soft pt-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">This month's cash flow</p>
        <div className="flex flex-col gap-4">
          <OverviewBand summary={mockFinanceSummary} showUdhaar={false} />
          <IncomeExpenseChart />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CategoryDonut />
            <PaymentMethodChart />
          </div>
        </div>
      </div>
    </div>
  )
}
