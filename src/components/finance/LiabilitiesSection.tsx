import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { LiabilityEditor } from './LiabilityEditor'
import { useLiabilities } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/formatCurrency'
import { getCreditCardOutstanding } from '@/lib/financeCalculations'
import type { FinancialAccount, LiabilityInput } from '@/types'

interface LiabilitiesSectionProps {
  accounts: FinancialAccount[]
}

export function LiabilitiesSection({ accounts }: LiabilitiesSectionProps) {
  const { liabilities, loading, error, refetch, createLiability, creating } = useLiabilities()
  const { showToast } = useToast()

  const [editorOpen, setEditorOpen] = useState(false)

  const creditCards = accounts.filter((a) => a.isActive && a.type === 'credit_card')
  const creditCardTotal = getCreditCardOutstanding(accounts)
  const manualTotal = liabilities.reduce((sum, l) => sum + l.amount, 0)
  const total = creditCardTotal + manualTotal

  const handleSave = async (input: LiabilityInput) => {
    await createLiability(input)
    showToast('Liability added')
    setEditorOpen(false)
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
        <ChartCardSkeleton />
      </Card>
    )
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
          <li key={liability.id} className="flex items-center justify-between gap-3 px-1.5 py-2 text-xs">
            <span className="text-ink-soft">{liability.name}</span>
            <span className="font-mono-figure font-semibold text-ink">{formatCurrency(liability.amount)}</span>
          </li>
        ))}
        {creditCards.length === 0 && liabilities.length === 0 && (
          <li className="px-1.5 py-3 text-xs text-ink-muted">No other liabilities.</li>
        )}
      </ul>

      <LiabilityEditor open={editorOpen} onClose={() => setEditorOpen(false)} onSave={handleSave} saving={creating} />
    </Card>
  )
}
