import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { AllocationDonut } from './AllocationDonut'
import { HoldingsTable } from './HoldingsTable'
import { InvestmentEditor } from './InvestmentEditor'
import { InvestmentDetail } from './InvestmentDetail'
import { useInvestments } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatPercentage } from '@/lib/formatCurrency'
import { getInvestmentTotals, getInvestmentTypeAllocation } from '@/lib/financeCalculations'
import { cn } from '@/lib/cn'
import type { FinancialAccount, Investment, InvestmentInput } from '@/types'

interface InvestmentsSectionProps {
  accounts: FinancialAccount[]
}

export function InvestmentsSection({ accounts }: InvestmentsSectionProps) {
  const { investments, loading, error, refetch, createInvestment, creating } = useInvestments()
  const { showToast } = useToast()

  const [viewingInvestment, setViewingInvestment] = useState<Investment | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const totals = getInvestmentTotals(investments)
  const allocation = getInvestmentTypeAllocation(investments)
  const positive = totals.gain >= 0

  const handleSave = async (input: InvestmentInput) => {
    await createInvestment(input)
    showToast('Investment added')
    setEditorOpen(false)
  }

  if (error) {
    return <ErrorState title="Couldn't load your investments." description={error} onRetry={refetch} />
  }

  if (loading) {
    return <ChartCardSkeleton />
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Total Investments</p>
            <p className="mt-1.5 text-hero-value text-ink">{formatCurrency(totals.current)}</p>
            <p className={cn('mt-2.5 flex items-center gap-1.5 font-mono-figure text-xs font-bold', positive ? 'text-success' : 'text-danger')}>
              {formatCurrency(totals.gain, { signed: true })}
              <span className="font-normal text-ink-muted">({formatPercentage(totals.returnPct, { signed: true })})</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border-soft pt-3 text-xs sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            <div>
              <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Invested</p>
              <p className="mt-0.5 font-mono-figure font-semibold text-ink">{formatCurrency(totals.invested, { compact: true })}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">Current</p>
              <p className="mt-0.5 font-mono-figure font-semibold text-ink">{formatCurrency(totals.current, { compact: true })}</p>
            </div>
          </div>
        </div>
      </Card>

      <AllocationDonut title="Investment Allocation" subtitle="By instrument type" data={allocation} centerLabel="Investments" />

      <Card variant="panel">
        <CardHeader
          title="Holdings"
          subtitle="Manually maintained values — not live market prices"
          action={
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditorOpen(true)}>
              Add Investment
            </Button>
          }
        />
        <HoldingsTable investments={investments} accounts={accounts} onSelect={setViewingInvestment} />
      </Card>

      <InvestmentDetail open={viewingInvestment !== null} investment={viewingInvestment} accounts={accounts} onClose={() => setViewingInvestment(null)} />

      <InvestmentEditor open={editorOpen} accounts={accounts} onClose={() => setEditorOpen(false)} onSave={handleSave} saving={creating} />
    </div>
  )
}
