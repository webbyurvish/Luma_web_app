import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LiabilityEditor } from './LiabilityEditor'
import { useAccounts, useLiabilities } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/formatCurrency'
import { getCreditCardOutstanding } from '@/lib/financeCalculations'
import type { Liability, LiabilityInput } from '@/types'

export function LiabilitiesSection() {
  const { accounts } = useAccounts()
  const { liabilities, createLiability, deleteLiability } = useLiabilities()
  const { showToast } = useToast()

  const [editorOpen, setEditorOpen] = useState(false)
  const [deletingLiability, setDeletingLiability] = useState<Liability | null>(null)

  const creditCards = accounts.filter((a) => a.isActive && a.type === 'credit_card')
  const creditCardTotal = getCreditCardOutstanding(accounts)
  const manualTotal = liabilities.reduce((sum, l) => sum + l.amount, 0)
  const total = creditCardTotal + manualTotal

  const handleSave = (input: LiabilityInput) => {
    createLiability(input)
    showToast('Liability added')
    setEditorOpen(false)
  }

  const handleConfirmDelete = () => {
    if (!deletingLiability) return
    deleteLiability(deletingLiability.id)
    showToast('Liability removed')
    setDeletingLiability(null)
  }

  return (
    <Card variant="panel">
      <CardHeader
        title="Liabilities"
        subtitle={`${formatCurrency(total, { compact: true })} total`}
        action={
          <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={() => setEditorOpen(true)}>
            Add Liability
          </Button>
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
            <div className="flex items-center gap-2">
              <span className="font-mono-figure font-semibold text-ink">{formatCurrency(liability.amount)}</span>
              <button
                onClick={() => setDeletingLiability(liability)}
                aria-label={`Delete ${liability.name}`}
                className="rounded-xs p-1 text-ink-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </li>
        ))}
        {creditCards.length === 0 && liabilities.length === 0 && (
          <li className="px-1.5 py-3 text-xs text-ink-muted">No other liabilities.</li>
        )}
      </ul>

      <LiabilityEditor open={editorOpen} onClose={() => setEditorOpen(false)} onSave={handleSave} />

      <ConfirmDialog
        open={deletingLiability !== null}
        title="Remove this liability?"
        description="This action cannot be undone."
        confirmLabel="Remove"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingLiability(null)}
      />
    </Card>
  )
}
