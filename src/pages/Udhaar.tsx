import { useState } from 'react'
import { HandCoins, Undo2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { UdhaarTable } from '@/components/udhaar/UdhaarTable'
import { QuickActionModal, type QuickActionKind } from '@/components/common/QuickActionModal'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockUdhaarSummary } from '@/data/mockUdhaar'

const stats = [
  { label: 'Total given', value: mockUdhaarSummary.totalGiven },
  { label: 'Total repaid', value: mockUdhaarSummary.totalRepaid, color: 'text-success' },
  { label: 'To receive', value: mockUdhaarSummary.toReceive, color: 'text-ai' },
  { label: 'Overdue', value: mockUdhaarSummary.overdue, color: 'text-danger' },
]

export function Udhaar() {
  const [modalKind, setModalKind] = useState<QuickActionKind | null>(null)

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="secondary" size="sm" icon={<Undo2 size={13} />} onClick={() => setModalKind('repayment')}>
          Add Repayment
        </Button>
        <Button size="sm" icon={<HandCoins size={13} />} onClick={() => setModalKind('udhaar')}>
          Add Udhaar
        </Button>
      </div>

      <Card variant="panel">
        <div className="grid grid-cols-2 divide-x divide-border-soft sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="px-4 first:pl-0 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{stat.label}</p>
              <p className={`mt-1.5 font-mono-figure text-lg font-bold ${stat.color ?? 'text-ink'}`}>{formatCurrency(stat.value, { compact: true })}</p>
            </div>
          ))}
        </div>
      </Card>

      <UdhaarTable />

      <QuickActionModal open={modalKind !== null} kind={modalKind ?? 'udhaar'} onClose={() => setModalKind(null)} />
    </div>
  )
}
