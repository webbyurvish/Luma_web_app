import { RowActions } from '@/components/ui/RowActions'
import { useState } from 'react'
import { Archive, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { SlowLoadHint, SyncBadge, SyncBar } from '@/components/ui/Loader'
import { getErrorMessage } from '@/lib/errors'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { LiabilityEditor } from './LiabilityEditor'
import { useLiabilities } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/formatCurrency'
import { getCreditCardOutstanding } from '@/lib/financeCalculations'
import type { FinancialAccount, Liability, LiabilityInput } from '@/types'

interface LiabilitiesSectionProps {
  accounts: FinancialAccount[]
}

export function LiabilitiesSection({ accounts }: LiabilitiesSectionProps) {
  const { liabilities, loading, refreshing, error, refetch, createLiability, creating, updateLiability, updating, closeLiability, closing, deleteLiability, deleting } = useLiabilities()
  const { showToast } = useToast()

  const [editorTarget, setEditorTarget] = useState<Liability | 'new' | null>(null)
  const [closeTarget, setCloseTarget] = useState<Liability | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Liability | null>(null)

  const creditCards = accounts.filter((a) => a.isActive && a.type === 'credit_card')
  const creditCardTotal = getCreditCardOutstanding(accounts)
  const manualTotal = liabilities.reduce((sum, l) => sum + l.amount, 0)
  const total = creditCardTotal + manualTotal

  const handleSave = async (input: LiabilityInput) => {
    try {
      if (editorTarget && editorTarget !== 'new') {
        await updateLiability(editorTarget.id, input)
        showToast('Liability updated')
      } else {
        await createLiability(input)
        showToast('Liability added')
      }
      setEditorTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the liability. Please try again."), 'error')
    }
  }

  const handleCloseConfirm = async () => {
    if (!closeTarget) return
    try {
      await closeLiability(closeTarget.id)
      showToast('Liability closed')
      setCloseTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't close the liability. Please try again."), 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteLiability(deleteTarget.id)
      showToast('Liability deleted')
      setDeleteTarget(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't delete the liability. Please try again."), 'error')
    }
  }

  if (error) {
    return (
      <Card variant="panel">
        <CardHeader title="Liabilities" subtitle="What you owe" />
        <ErrorState title="Couldn't load your liabilities." description={error} onRetry={refetch} />
      </Card>
    )
  }

  if (loading) {
    return (
      <Card variant="panel">
        <CardHeader title="Liabilities" subtitle="What you owe" />
        <ListSkeleton rows={3} />
        <SlowLoadHint />
      </Card>
    )
  }

  return (
    <Card variant="panel" className="relative">
      <SyncBar active={refreshing} />
      <CardHeader
        title="Liabilities"
        subtitle={`${formatCurrency(total, { compact: true })} total`}
        action={
          <div className="flex items-center gap-2">
            <SyncBadge active={refreshing} />
            <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={() => setEditorTarget('new')}>
              Add Liability
            </Button>
          </div>
        }
      />

      <ul className="-mx-1.5 divide-y divide-border-soft">
        {creditCards.map((card) => (
          <li key={card.id} className="flex items-center justify-between gap-3 px-1.5 py-2 text-xs">
            <span className="text-ink-soft">{card.name}</span>
            <span className="font-mono-figure font-semibold text-ink">{formatCurrency(card.balance)}</span>
          </li>
        ))}
        {liabilities.map((liability) => (
          <li key={liability.id} className="group flex items-center justify-between gap-3 px-1.5 py-2 text-xs">
            <span className="text-ink-soft">{liability.name}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono-figure font-semibold text-ink">{formatCurrency(liability.amount)}</span>
              <RowActions
                label={`Actions for ${liability.name}`}
                actions={[
                  { label: 'Edit', ariaLabel: `Edit ${liability.name}`, icon: <Pencil size={13} />, onClick: () => setEditorTarget(liability) },
                  { label: 'Close', ariaLabel: `Close ${liability.name}`, icon: <Archive size={13} />, onClick: () => setCloseTarget(liability), tone: 'warning' },
                  { label: 'Delete', ariaLabel: `Delete ${liability.name} permanently`, icon: <Trash2 size={13} />, onClick: () => setDeleteTarget(liability), tone: 'danger' },
                ]}
              />
            </div>
          </li>
        ))}
        {creditCards.length === 0 && liabilities.length === 0 && (
          <li className="px-1.5 py-3 text-xs text-ink-muted">No other liabilities.</li>
        )}
      </ul>

      <LiabilityEditor
        open={editorTarget !== null}
        liability={editorTarget === 'new' ? null : editorTarget}
        onClose={() => setEditorTarget(null)}
        onSave={handleSave}
        saving={creating || updating}
      />

      <ConfirmDialog
        open={closeTarget !== null}
        title="Close liability?"
        description={`"${closeTarget?.name}" will be marked closed and removed from your totals. It stays in your records.`}
        confirmLabel="Close"
        loading={closing}
        loadingLabel="Closing…"
        onConfirm={handleCloseConfirm}
        onCancel={() => setCloseTarget(null)}
      />

      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="liability"
        recordName={deleteTarget?.name}
        softActionLabel="Close"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  )
}
