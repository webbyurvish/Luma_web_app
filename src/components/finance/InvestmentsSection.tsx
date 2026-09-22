import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AllocationDonut } from './AllocationDonut'
import { HoldingsTable } from './HoldingsTable'
import { InvestmentEditor } from './InvestmentEditor'
import { InvestmentDetail } from './InvestmentDetail'
import { useAccounts, useInvestments } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatPercentage } from '@/lib/formatCurrency'
import { getInvestmentTotals, getInvestmentTypeAllocation } from '@/lib/financeCalculations'
import { cn } from '@/lib/cn'
import type { Investment, InvestmentInput } from '@/types'

export function InvestmentsSection() {
  const { investments, createInvestment, updateInvestment, deleteInvestment } = useInvestments()
  const { accounts } = useAccounts()
  const { showToast } = useToast()

  const [viewingInvestment, setViewingInvestment] = useState<Investment | null>(null)
  const [editorTarget, setEditorTarget] = useState<Investment | 'new' | null>(null)
  const [deletingInvestment, setDeletingInvestment] = useState<Investment | null>(null)

  const totals = getInvestmentTotals(investments)
  const allocation = getInvestmentTypeAllocation(investments)
  const positive = totals.gain >= 0

  const handleSave = (input: InvestmentInput) => {
    if (editorTarget && editorTarget !== 'new') {
      updateInvestment(editorTarget.id, input)
      showToast('Investment updated')
      if (viewingInvestment?.id === editorTarget.id) setViewingInvestment(null)
    } else {
      createInvestment(input)
      showToast('Investment added')
    }
    setEditorTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deletingInvestment) return
    deleteInvestment(deletingInvestment.id)
    showToast('Investment deleted')
    if (viewingInvestment?.id === deletingInvestment.id) setViewingInvestment(null)
    setDeletingInvestment(null)
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
          subtitle="Manually maintained demo values — not live market prices"
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
        onEdit={(inv) => {
          setViewingInvestment(null)
          setEditorTarget(inv)
        }}
        onDelete={setDeletingInvestment}
      />

      <InvestmentEditor
        open={editorTarget !== null}
        investment={editorTarget && editorTarget !== 'new' ? editorTarget : null}
        accounts={accounts}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deletingInvestment !== null}
        title="Delete this investment?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingInvestment(null)}
      />
    </div>
  )
}
