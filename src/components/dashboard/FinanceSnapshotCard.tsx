import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { StatTileSkeleton } from '@/components/ui/Skeleton'
import { FinanceStatTile } from '@/components/finance/FinanceStatTile'
import { useAccounts, useInvestments, useLiabilities, useSips } from '@/hooks/useFinanceCollections'
import { formatCurrency } from '@/lib/formatCurrency'
import { getInvestmentTotals, getMonthlySipTotal, getNetWorth } from '@/lib/financeCalculations'
import { mockUdhaarSummary } from '@/data/mockUdhaar'

export function FinanceSnapshotCard() {
  const { accounts, loading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAccounts()
  const { investments, loading: investmentsLoading, error: investmentsError, refetch: refetchInvestments } = useInvestments()
  const { sips, loading: sipsLoading, error: sipsError, refetch: refetchSips } = useSips()
  const { liabilities, loading: liabilitiesLoading, error: liabilitiesError, refetch: refetchLiabilities } = useLiabilities()

  const loading = accountsLoading || investmentsLoading || sipsLoading || liabilitiesLoading
  const error = accountsError ?? investmentsError ?? sipsError ?? liabilitiesError
  const retry = () => {
    refetchAccounts()
    refetchInvestments()
    refetchSips()
    refetchLiabilities()
  }

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
      {error ? (
        <ErrorState title="Couldn't load your financial snapshot." description={error} onRetry={retry} />
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <StatTileSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FinanceStatTile label="Net Worth" value={formatCurrency(netWorth.netWorth, { compact: true })} />
          <FinanceStatTile label="Investments" value={formatCurrency(investmentTotals.current, { compact: true })} />
          <FinanceStatTile label="Monthly SIP" value={formatCurrency(monthlySip, { compact: true })} />
          <FinanceStatTile label="Udhaar" value={formatCurrency(udhaarReceivable, { compact: true })} />
        </div>
      )}
    </Card>
  )
}
