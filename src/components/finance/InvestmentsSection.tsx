import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton, NetWorthPanelSkeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBadge, SyncBar } from '@/components/ui/Loader'
import { getErrorMessage } from '@/lib/errors'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
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
  const { investments, loading, refreshing, error, refetch, createInvestment, creating, updateInvestment, updating, archiveInvestment, archiving } = useInvestments()
  const { showToast } = useToast()

  const [viewingInvestment, setViewingInvestment] = useState<Investment | null>(null)
  const [editorTarget, setEditorTarget] = useState<Investment | 'new' | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Investment | null>(null)

  const totals = getInvestmentTotals(investments)
  const allocation = getInvestmentTypeAllocation(investments)
  const positive = totals.gain >= 0

  const handleSave = async (input: InvestmentInput) => {
    try {
      if (editorTarget && editorTarget !== 'new') {
        await updateInvestment(editorTarget.id, input)
        showToast('Investment updated')
      } else {
        await createInvestment(input)
        showToast('Investment added')
      }
      setEditorTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the investment. Please try again."), 'error')
    }
  }

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return
    try {
      await archiveInvestment(archiveTarget.id)
      showToast('Investment archived')
      setArchiveTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't archive the investment. Please try again."), 'error')
    }
  }

  if (error) {
    return <ErrorState title="Couldn't load your investments." description={error} onRetry={refetch} />
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <NetWorthPanelSkeleton />
        <Card variant="panel">
          <ListSkeleton rows={4} />
          <SlowLoadHint />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="panel" className="relative">
        <SyncBar active={refreshing} />
        <div className="absolute -top-2.5 right-5 z-10">
          <SyncBadge active={refreshing} />
        </div>
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
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditorTarget('new')}>
              Add Investment
            </Button>
          }
        />
        <HoldingsTable investments={investments} accounts={accounts} onSelect={setViewingInvestment} />
      </Card>

      <InvestmentDetail
        open={viewingInvestment !== null}
        investment={viewingInvestment}
        accounts={accounts}
        onClose={() => setViewingInvestment(null)}
        onEdit={(investment) => {
          setViewingInvestment(null)
          setEditorTarget(investment)
        }}
        onArchive={(investment) => {
          setViewingInvestment(null)
          setArchiveTarget(investment)
        }}
      />

      <InvestmentEditor
        open={editorTarget !== null}
        investment={editorTarget === 'new' ? null : editorTarget}
        accounts={accounts}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
        saving={creating || updating}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive investment?"
        description={`"${archiveTarget?.name}" will be hidden from your holdings and totals. Its history is kept.`}
        confirmLabel="Archive"
        loading={archiving}
        loadingLabel="Archiving…"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}
