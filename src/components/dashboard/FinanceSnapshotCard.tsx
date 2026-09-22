import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/ui/Card'
import { FinanceStatTile } from '@/components/finance/FinanceStatTile'
import { useAccounts, useInvestments, useLiabilities, useSips } from '@/hooks/useFinanceCollections'
import { formatCurrency } from '@/lib/formatCurrency'
import { getInvestmentTotals, getMonthlySipTotal, getNetWorth } from '@/lib/financeCalculations'
import { mockUdhaarSummary } from '@/data/mockUdhaar'

export function FinanceSnapshotCard() {
  const { accounts } = useAccounts()
  const { investments } = useInvestments()
  const { sips } = useSips()
  const { liabilities } = useLiabilities()

  const udhaarReceivable = mockUdhaarSummary.toReceive
  const netWorth = getNetWorth({ accounts, investments, liabilities, udhaarReceivable })
  const investmentTotals = getInvestmentTotals(investments)
  const monthlySip = getMonthlySipTotal(sips)

  return (
    <Card hoverable>
      <CardHeader
        title="Financial Snapshot"
        subtitle="Your complete money picture"
        action={
          <Link to="/finance" className="text-[10px] font-semibold uppercase tracking-[0.06em] text-rust hover:underline">
            View finances →
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FinanceStatTile label="Net Worth" value={formatCurrency(netWorth.netWorth, { compact: true })} />
        <FinanceStatTile label="Investments" value={formatCurrency(investmentTotals.current, { compact: true })} />
        <FinanceStatTile label="Monthly SIP" value={formatCurrency(monthlySip, { compact: true })} />
        <FinanceStatTile label="Udhaar" value={formatCurrency(udhaarReceivable, { compact: true })} />
      </div>
    </Card>
  )
}
